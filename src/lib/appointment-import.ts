import type { Appointment, AppointmentType } from "./client-messages";

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
  return { massage: /\bmassages?\b/i.test(text), facial: /\bfacials?\b/i.test(text),
    body: /\bbody\b|\blymphatic reset\b/i.test(text) };
}

function isAddOn(service: AppointmentNode["appointmentServices"][number]["service"]) {
  return /\badd[\s\-–—]*ons?\b|\benhancements?\b/i.test(
    `${service.name} ${service.category?.name || ""}`) ||
    // This existing couples enhancement is not labeled Add-On in its service name.
    /^\s*deep tissue focus for [12]\s*$/i.test(service.name);
}

function mainServices(node: AppointmentNode) {
  return node.appointmentServices.filter(({ service }) => !isAddOn(service));
}

export function classifyAppointment(node: AppointmentNode): AppointmentType {
  // Extra service lines, add-ons, and practitioner counts do not prove a combined visit.
  const services = mainServices(node);
  const kinds = services.map(({ service }) => serviceKind(service));
  if (kinds.some(({ massage }) => massage) && kinds.some(({ facial }) => facial)) {
    return "Massage & Facial Experience";
  }
  // A group flag or multiple practitioners alone does not mean couples massage.
  if (services.some(({ service }) =>
    /^\s*couples?\b/i.test(service.name) || /\bcouples?\s+massage\b/i.test(service.name))) {
    return "Couples Massage";
  }
  if (kinds.some(({ body }) => body) && kinds.some(({ facial }) => facial)) {
    return "Combined Experience";
  }
  if (kinds.some(({ facial }) => facial)) return "Facial";
  return "Standard";
}

function inferSuite(node: AppointmentNode) {
  for (const { resource } of node.appointmentServiceResources) {
    const room = resourceRoom(resource.name);
    if (room && ROOM_TO_SUITE[room]) return ROOM_TO_SUITE[room];
  }
  // Room-specific couples services can carry the room in their name only.
  // Use the same unambiguous room evidence as the partner matcher.
  if (classifyAppointment(node) === "Couples Massage") {
    const rooms = assignedRooms(node);
    const room = rooms.size === 1 ? Array.from(rooms)[0] : undefined;
    if (room && ROOM_TO_SUITE[room]) return ROOM_TO_SUITE[room];
  }
  return "Suite #1";
}

function normalizeAppointment(node: AppointmentNode, timeZone: string): Appointment {
  const couples = couplesMatch(node);
  const guestOrder = (item: AppointmentNode["appointmentServices"][number]) => {
    const guest = couplesService(node, item)?.guest;
    if (guest) return Number(guest);
    const addonGuest = isAddOn(item.service) && /\bfor\s+([12])\b/i.exec(item.service.name);
    return addonGuest ? Number(addonGuest[1]) + 0.5 : 3;
  };
  const orderedServices = [...node.appointmentServices].sort((a, b) =>
    Date.parse(a.startAt) - Date.parse(b.startAt) || (couples?.embeddedPartner ?
      guestOrder(a) - guestOrder(b) : 0));
  const practitioners = Array.from(new Set(orderedServices.map(({ staff }) => staffName(staff)).filter(Boolean)));
  return {
    appointmentId: node.id,
    clientName: node.client.firstName || node.client.lastName || "Client",
    mobilePhone: node.client.mobilePhone || "",
    clientType: node.client.appointmentCount <= 1 ? "New Client" : "Returning Client",
    appointmentType: classifyAppointment(node),
    greetingTime: "Auto",
    // Guest roles, not the provider's array order, identify the grouped booking's staff.
    practitioner: couples?.name || practitioners[0] || "",
    secondPractitioner: couples ? couples.embeddedPartner?.name || "" : practitioners[1] || "",
    suite: inferSuite(node),
    time: new Intl.DateTimeFormat("en-US", {
      timeZone, hour: "numeric", minute: "2-digit",
    }).format(new Date(node.startAt)),
    serviceSummary: orderedServices.map(({ service }) => service.name).join(" + "),
    // An aggregate count cannot identify intake requirements or distinguish charts.
    // Never infer either Complete or Incomplete from it, including a zero count.
    intakeStatus: "Unknown",
    pendingFormCount: typeof node.pendingFormCount === "number" &&
      Number.isSafeInteger(node.pendingFormCount) && node.pendingFormCount >= 0 ?
      node.pendingFormCount : null,
  };
}

type CouplesService = {
  key: string;
  guest: string | null;
};
type CouplesMember = CouplesService & {
  staffId: string;
  name: string;
};
type CouplesMatch = CouplesMember & { embeddedPartner?: CouplesMember };

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

function couplesService(node: AppointmentNode,
  item: AppointmentNode["appointmentServices"][number]): CouplesService | null {
  if (isAddOn(item.service)) return null;
  if (!/^\s*couples?\b/i.test(item.service.name) &&
    !/\bcouples?\s+massage\b/i.test(item.service.name)) return null;
  const start = Date.parse(item.startAt);
  if (!Number.isFinite(start)) return null;
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
  return { key: `${start}|${room}|${family}`, guest: guestMatch?.[1] ?? null };
}

function couplesMember(node: AppointmentNode,
  item: AppointmentNode["appointmentServices"][number]): CouplesMember | null {
  const service = couplesService(node, item);
  const name = staffName(item.staff);
  if (!service || !name || !item.staff.id) return null;
  return { ...service, staffId: item.staff.id, name };
}

function couplesMatch(node: AppointmentNode): CouplesMatch | null {
  if (classifyAppointment(node) !== "Couples Massage") return null;
  const services = mainServices(node);
  if (services.length === 1) return couplesMember(node, services[0]);
  // Only an explicit two-role group can anchor a separately created Guest 2 profile.
  // Recognized add-ons are retained in summaries but do not count as extra guests.
  // Unknown extra services, mismatched timing/family/rooms, or missing staff are not guessed.
  // Explicit complementary service roles are sufficient; the provider's group flag
  // is not required to establish this two-service structure.
  if (services.length !== 2) return null;
  const members = services.map((item) => couplesMember(node, item));
  const first = members.find((member) => member?.guest === "1");
  const second = members.find((member) => member?.guest === "2");
  if (!first || !second || first.key !== second.key || first.staffId === second.staffId ||
    first.name.toLowerCase() === second.name.toLowerCase()) return null;
  return { ...first, embeddedPartner: second };
}

function unlinkedGuest2ProfileStatus(node: AppointmentNode, active: AppointmentNode[]):
  NonNullable<Appointment["guest2ProfileStatus"]> {
  if (!node.clientId || (!node.isGroupedAppointment && !couplesMatch(node)?.embeddedPartner)) return "Unknown";
  const members = mainServices(node).map((item) => couplesService(node, item));
  const first = members.find((member) => member?.guest === "1");
  if (!first || members.some((member) => !member || member.key !== first.key)) return "Unknown";
  const hasEmbeddedGuest2 = members.length === 2 && members.some((member) => member?.guest === "2");
  const hasSeparatePlaceholder = members.length === 1 && active.some((other) =>
    other.id !== node.id && other.clientId === node.clientId && mainServices(other).length === 1 &&
    couplesService(other, mainServices(other)[0])?.key === first.key &&
    couplesService(other, mainServices(other)[0])?.guest === "2");
  if (!hasEmbeddedGuest2 && !hasSeparatePlaceholder) return "Unknown";
  // An unlinked profile may already exist but have ambiguous or inconsistent staff.
  // Examine service identity independently of staff to avoid a false contact request.
  const possibleSeparateProfile = active.some((other) => {
    if (other.id === node.id || other.clientId === node.clientId) return false;
    return other.appointmentServices.some((item) => {
      if (!/\bguest\s*[-#]?\s*2\b/i.test(item.service.name)) return false;
      const service = couplesService(other, item);
      if (service) return service.key === first.key;
      // Incomplete room/service evidence at the same time requires review, not absence inference.
      return Date.parse(item.startAt) === Number(first.key.split("|")[0]);
    });
  });
  return possibleSeparateProfile ? "Unknown" : "Missing";
}

function couplesReviewDetail(index: number, nodes: AppointmentNode[],
  matches: (CouplesMatch | null)[], candidates: number[][]): string {
  const recordIssue = (node: AppointmentNode) => {
    const services = mainServices(node);
    if (services.length < 1 || services.length > 2) return "Extra or missing main services prevent identifying the guest roles.";
    if (assignedRooms(node).size !== 1) return "Room information is missing or conflicting.";
    if (services.some(item => !item.staff.id)) return "A required staff identifier is missing.";
    if (services.some(item => !staffName(item.staff))) return "A required practitioner name is missing.";
    return "The main guest services do not agree on roles, exact start time, service family, or distinct staff.";
  };
  const match = matches[index];
  if (!match) return recordIssue(nodes[index]);
  if (candidates[index].length > 1 || candidates[index].some(i => candidates[i].length > 1)) {
    return "More than one eligible partner appointment was found.";
  }
  const related = nodes.flatMap((node, otherIndex) => {
    if (index === otherIndex || nodes[index].id === node.id) return [];
    return mainServices(node).some(item => {
      const service = couplesService(node, item);
      return service?.key === match.key && service.guest && service.guest !== match.guest;
    }) ? [otherIndex] : [];
  });
  const reasons = related.map(otherIndex => {
    const other = matches[otherIndex];
    if (!other) return `Potential partner: ${recordIssue(nodes[otherIndex])}`;
    if (!nodes[index].clientId || !nodes[otherIndex].clientId) return "A required client profile identifier is missing.";
    if (nodes[index].clientId === nodes[otherIndex].clientId) return "Both appointments use the same client profile, not two separate profiles.";
    const group = match.embeddedPartner ? match : other.embeddedPartner ? other : null;
    const separate = match.embeddedPartner ? other : match;
    if (group && group.embeddedPartner!.staffId !== separate.staffId) {
      return "The grouped and separate Guest 2 staff identifiers do not agree, even if their displayed names match.";
    }
    if (match.staffId === other.staffId || match.name.toLowerCase() === other.name.toLowerCase()) {
      return "Two distinct practitioner assignments are required.";
    }
    return "The potential partner is not uniquely associated in both directions.";
  });
  return Array.from(new Set(reasons)).join(" ") ||
    "No complementary guest service with the same exact start time, room, and service family was found.";
}

function orderCouplesCards(appointments: Appointment[], nodes: AppointmentNode[], matches: (CouplesMatch | null)[]) {
  const displayCandidates = appointments.map((appointment, index) => {
    if (appointment.partnerAppointmentId) {
      return appointments.flatMap((other, otherIndex) =>
        other.appointmentId === appointment.partnerAppointmentId &&
        other.partnerAppointmentId === appointment.appointmentId ? [otherIndex] : []);
    }
    // Same-client placeholders may be adjacent for display, but remain unlinked and unchanged.
    const match = matches[index];
    if (!match?.guest || match.embeddedPartner || !nodes[index].clientId) return [];
    return matches.flatMap((other, otherIndex) => {
      if (!other?.guest || other.embeddedPartner || index === otherIndex ||
        appointments[otherIndex].partnerAppointmentId || nodes[index].id === nodes[otherIndex].id ||
        nodes[index].clientId !== nodes[otherIndex].clientId ||
        !(nodes[index].isGroupedAppointment || nodes[otherIndex].isGroupedAppointment) ||
        match.key !== other.key || match.guest === other.guest) return [];
      return [otherIndex];
    });
  });
  const ordered: Appointment[] = [];
  const placed = new Set<number>();
  // The existing chronological order anchors each pair at its earliest card.
  // Move whole cards, never individual names, contact details, or review state.
  appointments.forEach((appointment, index) => {
    if (placed.has(index)) return;
    const partner = displayCandidates[index][0];
    if (displayCandidates[index].length === 1 && !placed.has(partner) &&
      displayCandidates[partner].length === 1 && displayCandidates[partner][0] === index) {
      const first = matches[index]?.guest === "2" && matches[partner]?.guest === "1" ? partner : index;
      const second = first === index ? partner : index;
      ordered.push(appointments[first], appointments[second]);
      placed.add(first); placed.add(second);
    } else {
      ordered.push(appointment); placed.add(index);
    }
  });
  return ordered;
}

export function normalizeDailyAppointments(nodes: AppointmentNode[], timeZone: string): Appointment[] {
  const active = nodes.filter((node) => !node.cancelled)
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  const appointments = active.map((node) => normalizeAppointment(node, timeZone));
  const matches = active.map(couplesMatch);
  const candidates = matches.map((match, index) => match ? matches.flatMap((other, otherIndex) => {
    if (!other || index === otherIndex || active[index].id === active[otherIndex].id ||
      match.key !== other.key || match.staffId === other.staffId ||
      match.name.toLowerCase() === other.name.toLowerCase()) return [];
    if (active[index].clientId && active[index].clientId === active[otherIndex].clientId) return [];
    if ((match.guest || other.guest) && (!match.guest || !other.guest || match.guest === other.guest)) return [];
    if (match.embeddedPartner || other.embeddedPartner) {
      const group = match.embeddedPartner ? match : other;
      const separate = match.embeddedPartner ? other : match;
      // Both profiles must be known and different; never treat a placeholder as a new client.
      if (!active[index].clientId || !active[otherIndex].clientId || separate.embeddedPartner ||
        separate.guest !== "2" || group.embeddedPartner!.staffId !== separate.staffId) return [];
    }
    return [otherIndex];
  }) : []);
  const normalized: Appointment[] = appointments.map((appointment, index) => {
    if (appointment.appointmentType !== "Couples Massage") return appointment;
    appointment = { ...appointment, guest2ProfileStatus: unlinkedGuest2ProfileStatus(active[index], active) };
    const partnerIndex = candidates[index][0];
    if (candidates[index].length === 1 && candidates[partnerIndex].length === 1 &&
      candidates[partnerIndex][0] === index) {
      return { ...appointment, secondPractitioner: matches[index]?.embeddedPartner?.name || matches[partnerIndex]!.name,
        partnerAppointmentId: active[partnerIndex].id, guest2ProfileStatus: "Linked" };
    }
    if (appointment.secondPractitioner && matches[index]?.embeddedPartner) {
      const related = matches.some((other, otherIndex) => other && otherIndex !== index &&
        other.key === matches[index]!.key && other.guest === "2" &&
        active[otherIndex].clientId !== active[index].clientId);
      if (!related) return appointment;
      return { ...appointment, importWarnings: [
        "A separate Guest 2 record could not be linked uniquely or has a different staff assignment. Verify the two client cards and practitioner assignments; no records were merged.",
        couplesReviewDetail(index, active, matches, candidates),
      ] };
    }
    if (appointment.secondPractitioner) return { ...appointment, importWarnings: [
      "This multi-service couples record could not be associated by explicit guest roles. Verify client and practitioner assignments before copying.",
      couplesReviewDetail(index, active, matches, candidates),
    ] };
    return { ...appointment, importWarnings: [
      "Couples partner could not be matched uniquely. Verify Practitioner 2 before copying.",
      couplesReviewDetail(index, active, matches, candidates),
    ] };
  });
  return orderCouplesCards(normalized, active, matches);
}
