import type { Appointment, AppointmentType, IntakeStatus } from "./client-messages";

// Provider data is transformed without credentials, network access, or form contents.
export type AppointmentNode = {
  id: string;
  clientId?: string;
  startAt: string;
  endAt: string;
  cancelled: boolean;
  isGroupedAppointment: boolean;
  pendingFormCount?: number | null;
  client: {
    firstName: string | null;
    lastName: string | null;
    mobilePhone: string | null;
    appointmentCount: number;
  };
  appointmentServices: Array<{
    id: string;
    startAt: string;
    staff: { id?: string; displayName: string; firstName: string; name: string };
    service: { name: string; category: { name: string } | null };
  }>;
  appointmentServiceResources: Array<{ resource: { name: string } }>;
};

const ROOM_TO_SUITE: Record<number, string> = {
  1: "Suite #1", 2: "Suite #1", 3: "Suite #1",
  4: "Suite #4", 5: "Suite #4", 6: "Suite #4",
};

function resourceRoom(name: string) {
  const match = /^(?:couples\s+)?room\s*#?\s*(\d+)$/i.exec(name.trim());
  return match ? Number(match[1]) : null;
}

function staffName(staff: AppointmentNode["appointmentServices"][number]["staff"]) {
  return (staff.displayName || staff.firstName || staff.name || "").trim();
}

function serviceKind(service: AppointmentNode["appointmentServices"][number]["service"]) {
  const text = `${service.name} ${service.category?.name || ""}`;
  return { massage: /massage/i.test(text), facial: /facial/i.test(text) };
}

export function classifyAppointment(node: AppointmentNode): AppointmentType {
  const kinds = node.appointmentServices.map(({ service }) => serviceKind(service));
  if (kinds.some(({ massage }) => massage) && kinds.some(({ facial }) => facial)) {
    return "Massage & Facial Experience";
  }
  // A group flag or multiple practitioners alone does not mean couples massage.
  if (node.appointmentServices.some(({ service }) =>
    /^\s*couples?\b/i.test(service.name) || /\bcouples?\s+massage\b/i.test(service.name))) {
    return "Couples Massage";
  }
  if (node.appointmentServices.length > 1 && kinds.some(({ facial }) => facial)) {
    return "Combined Experience";
  }
  return "Standard";
}

export function intakeStatusFromCount(count: number | null | undefined): IntakeStatus {
  return typeof count === "number" && Number.isSafeInteger(count) && count >= 0 ?
    count > 0 ? "Incomplete" : "Complete" : "Unknown";
}

function inferSuite(node: AppointmentNode) {
  for (const { resource } of node.appointmentServiceResources) {
    const room = resourceRoom(resource.name);
    if (room && ROOM_TO_SUITE[room]) return ROOM_TO_SUITE[room];
  }
  // Room-specific couples services can carry the room in their name only.
  // Use the same unambiguous room evidence as the partner matcher.
  if (classifyAppointment(node) === "Couples Massage" && node.appointmentServices.length === 1) {
    const rooms = assignedRooms(node);
    const room = rooms.size === 1 ? Array.from(rooms)[0] : undefined;
    if (room && ROOM_TO_SUITE[room]) return ROOM_TO_SUITE[room];
  }
  return "Suite #1";
}

function normalizeAppointment(node: AppointmentNode, timeZone: string): Appointment {
  const orderedServices = [...node.appointmentServices].sort((a, b) =>
    Date.parse(a.startAt) - Date.parse(b.startAt));
  const practitioners = Array.from(new Set(orderedServices.map(({ staff }) => staffName(staff)).filter(Boolean)));
  return {
    appointmentId: node.id,
    clientName: node.client.firstName || node.client.lastName || "Client",
    mobilePhone: node.client.mobilePhone || "",
    clientType: node.client.appointmentCount <= 1 ? "New Client" : "Returning Client",
    appointmentType: classifyAppointment(node),
    greetingTime: "Morning",
    practitioner: practitioners[0] || "",
    secondPractitioner: practitioners[1] || "",
    suite: inferSuite(node),
    time: new Intl.DateTimeFormat("en-US", {
      timeZone, hour: "numeric", minute: "2-digit",
    }).format(new Date(node.startAt)),
    serviceSummary: orderedServices.map(({ service }) => service.name).join(" + "),
    intakeStatus: intakeStatusFromCount(node.pendingFormCount),
    pendingFormCount: node.pendingFormCount ?? null,
  };
}

type CouplesMatch = {
  key: string;
  guest: string | null;
  staffId: string;
  name: string;
};

function assignedRooms(node: AppointmentNode) {
  const rooms = new Set(node.appointmentServiceResources
    .map(({ resource }) => resourceRoom(resource.name)).filter((room) => room !== null));
  for (const { service } of node.appointmentServices) {
    for (const match of service.name.matchAll(/\b(?:r|room)\s*#?\s*(\d+)\b/gi)) {
      rooms.add(Number(match[1]));
    }
  }
  return rooms;
}

function couplesMatch(node: AppointmentNode): CouplesMatch | null {
  if (classifyAppointment(node) !== "Couples Massage") return null;
  // Multi-service records are not guessed into a two-appointment pair.
  if (node.appointmentServices.length !== 1) return null;
  const item = node.appointmentServices[0];
  const start = Date.parse(item.startAt);
  const name = staffName(item.staff);
  if (!Number.isFinite(start) || !name || !item.staff.id) return null;
  const rooms = assignedRooms(node);
  if (rooms.size !== 1) return null;
  const room = Array.from(rooms)[0];
  if (!room || !ROOM_TO_SUITE[room]) return null;
  const guestMatch = /\bguest\s*[-#]?\s*([12])\b/i.exec(item.service.name);
  const family = item.service.name.toLowerCase()
    .replace(/\bguest\s*[-#]?\s*[12]\b/g, "")
    .replace(/\b(?:r|room)\s*#?\s*\d+\b/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
  // Exact instant + room + service family (including duration). Never match a suite alone.
  return { key: `${start}|${room}|${family}`, guest: guestMatch?.[1] ?? null,
    staffId: item.staff.id, name };
}

export function normalizeDailyAppointments(nodes: AppointmentNode[], timeZone: string): Appointment[] {
  const active = nodes.filter((node) => !node.cancelled)
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  const appointments = active.map((node) => normalizeAppointment(node, timeZone));
  const matches = active.map(couplesMatch);
  const candidates = matches.map((match, index) => match ? matches.flatMap((other, otherIndex) => {
    if (!other || index === otherIndex || active[index].id === active[otherIndex].id ||
      match.key !== other.key || match.staffId === other.staffId || match.name === other.name) return [];
    if (active[index].clientId && active[index].clientId === active[otherIndex].clientId) return [];
    if ((match.guest || other.guest) && (!match.guest || !other.guest || match.guest === other.guest)) return [];
    return [otherIndex];
  }) : []);
  return appointments.map((appointment, index) => {
    if (appointment.appointmentType !== "Couples Massage") return appointment;
    if (appointment.secondPractitioner) return appointment;
    const partnerIndex = candidates[index][0];
    if (candidates[index].length === 1 && candidates[partnerIndex].length === 1 &&
      candidates[partnerIndex][0] === index) {
      return { ...appointment, secondPractitioner: matches[partnerIndex]!.name,
        partnerAppointmentId: active[partnerIndex].id };
    }
    return { ...appointment, importWarnings: [
      "Couples partner could not be matched uniquely. Verify Practitioner 2 before copying.",
    ] };
  });
}
