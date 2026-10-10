export const PRACTITIONERS = [
  "Peter", "Liann", "Mindy", "Tiffany", "Stephanie", "Mina", "Meghan",
];

export type AppointmentType =
  | "Standard"
  | "Facial"
  | "Couples Massage"
  | "Massage & Facial Experience"
  | "Combined Experience";
export type IntakeStatus = "Unknown" | "Complete" | "Incomplete";
export type ManualGreeting = "Morning" | "Afternoon" | "Hi";

export function greetingInBoise(now: Date = new Date()): ManualGreeting {
  if (!Number.isFinite(now.getTime())) return "Hi";
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Boise", hour: "numeric", hourCycle: "h23",
  }).format(now));
  return hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Hi";
}

export type Appointment = {
  appointmentId?: string;
  clientName: string;
  mobilePhone: string;
  clientType: "New Client" | "Returning Client";
  appointmentType: AppointmentType;
  greetingTime: "Auto" | ManualGreeting;
  practitioner: string;
  secondPractitioner: string;
  suite: string;
  time: string;
  serviceSummary: string;
  intakeStatus: IntakeStatus;
  pendingFormCount?: number | null;
  partnerAppointmentId?: string;
  guest2ProfileStatus?: "Unknown" | "Missing" | "Linked";
  importWarnings?: string[];
};

export type SuiteInfo = {
  mapUrl: string;
  directions: string;
  imageLabel: string;
  imageUrl: string;
};

export const INTAKE_REMINDER =
  "Also, please check that you have your online intake form filled out before you arrive, so that we can be sure to begin your session on time.";
export const GUEST_2_CONTACT_REQUEST =
  "Also, if we could get your Guest #2 name and cell number, we could text them the online intake form link for them to fill out before you arrive? If you both have your forms filled out beforehand, we can be sure to begin your session on time.";

export function isRetiredPractitioner(name: string) {
  return /^rebecca(?:\s|$)/i.test(name.trim());
}

export function practitionerOptions(importedName: string) {
  return Array.from(new Set([...PRACTITIONERS, importedName.trim()]))
    .filter((name) => name && !isRetiredPractitioner(name));
}

export function needsSecondPractitioner(appointment: Appointment) {
  return appointment.appointmentType === "Couples Massage" ||
    appointment.appointmentType === "Massage & Facial Experience" ||
    appointment.appointmentType === "Combined Experience";
}

export function canCopyMessage(appointment: Appointment) {
  // An unresolved couples pairing must be reviewed, never silently guessed.
  return appointment.appointmentType !== "Couples Massage" ||
    Boolean(appointment.practitioner.trim() && appointment.secondPractitioner.trim() &&
      appointment.practitioner.trim().toLowerCase() !== appointment.secondPractitioner.trim().toLowerCase());
}

export function generateText(appointment: Appointment, suiteInfo: SuiteInfo, now?: Date) {
  const choice = appointment.greetingTime === "Auto" ? greetingInBoise(now) : appointment.greetingTime;
  const greeting = choice === "Hi" ? "Hi" :
    choice === "Afternoon" ? "Good Afternoon" : "Good Morning";
  const client = appointment.clientName.trim() || "Client";
  const names = Array.from(new Set([
    appointment.practitioner.trim(),
    needsSecondPractitioner(appointment) ? appointment.secondPractitioner.trim() : "",
  ].filter(Boolean)));
  const practitioners = names.length ? names.join(" and ") : "your practitioner";
  const visit = appointment.appointmentType === "Couples Massage" ? "couples massage" :
    appointment.appointmentType === "Massage & Facial Experience" ? "Massage & Facial Experience" :
    appointment.appointmentType === "Combined Experience" ? "combined experience" :
    appointment.appointmentType === "Facial" ? "facial session" : "session";
  const introduction = appointment.clientType === "New Client" ?
    "just to clarify (the auto text might be a little confusing), " : "";
  const time = appointment.time ? ` at ${appointment.time}` : "";
  const map = suiteInfo.mapUrl ? ` ${suiteInfo.mapUrl}` : "";
  const directions = appointment.clientType === "New Client" && suiteInfo.directions ?
    ` ${suiteInfo.directions}` : "";
  const requestGuest2 = appointment.appointmentType === "Couples Massage" &&
    appointment.guest2ProfileStatus === "Missing";
  const reminder = requestGuest2 ? ` ${GUEST_2_CONTACT_REQUEST}` :
    appointment.intakeStatus === "Incomplete" ? ` ${INTAKE_REMINDER}` : "";
  return `${greeting} ${client}, EN Spa here - ${introduction}your ${visit} today${time} with ${practitioners} is in ${appointment.suite}.${map}${directions}${reminder} Thank you - we’ll see you soon!`;
}
