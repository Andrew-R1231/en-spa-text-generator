export const PRACTITIONERS = [
  "Peter", "Liann", "Mindy", "Tiffany", "Stephanie", "Mina", "Meghan",
];

export type AppointmentType =
  | "Standard"
  | "Couples Massage"
  | "Massage & Facial Experience"
  | "Combined Experience";
export type IntakeStatus = "Unknown" | "Complete" | "Incomplete";

export type Appointment = {
  appointmentId?: string;
  clientName: string;
  mobilePhone: string;
  clientType: "New Client" | "Returning Client";
  appointmentType: AppointmentType;
  greetingTime: "Morning" | "Afternoon" | "Hi";
  practitioner: string;
  secondPractitioner: string;
  suite: string;
  time: string;
  serviceSummary: string;
  intakeStatus: IntakeStatus;
  pendingFormCount?: number | null;
  partnerAppointmentId?: string;
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

export function isRetiredPractitioner(name: string) {
  return /^rebecca(?:\s|$)/i.test(name.trim());
}

export function practitionerOptions(importedName: string) {
  return Array.from(new Set([...PRACTITIONERS, importedName.trim()]))
    .filter((name) => name && !isRetiredPractitioner(name));
}

export function needsSecondPractitioner(appointment: Appointment) {
  return appointment.appointmentType !== "Standard";
}

export function canCopyMessage(appointment: Appointment) {
  // An unresolved couples pairing must be reviewed, never silently guessed.
  return appointment.appointmentType !== "Couples Massage" ||
    Boolean(appointment.practitioner.trim() && appointment.secondPractitioner.trim() &&
      appointment.practitioner.trim().toLowerCase() !== appointment.secondPractitioner.trim().toLowerCase());
}

export function generateText(appointment: Appointment, suiteInfo: SuiteInfo) {
  const greeting = appointment.greetingTime === "Hi" ? "Hi" :
    appointment.greetingTime === "Afternoon" ? "Good Afternoon" : "Good Morning";
  const client = appointment.clientName.trim() || "Client";
  const names = Array.from(new Set([
    appointment.practitioner.trim(),
    needsSecondPractitioner(appointment) ? appointment.secondPractitioner.trim() : "",
  ].filter(Boolean)));
  const practitioners = names.length ? names.join(" and ") : "your practitioner";
  const visit = appointment.appointmentType === "Couples Massage" ? "couples massage" :
    appointment.appointmentType === "Massage & Facial Experience" ? "Massage & Facial Experience" :
    appointment.appointmentType === "Combined Experience" ? "combined experience" : "session";
  const introduction = appointment.clientType === "New Client" ?
    "just to clarify (the auto text might be a little confusing), " : "";
  const time = appointment.time ? ` at ${appointment.time}` : "";
  const map = suiteInfo.mapUrl ? ` ${suiteInfo.mapUrl}` : "";
  const directions = appointment.clientType === "New Client" && suiteInfo.directions ?
    ` ${suiteInfo.directions}` : "";
  const reminder = appointment.intakeStatus === "Incomplete" ? ` ${INTAKE_REMINDER}` : "";
  return `${greeting} ${client}, EN Spa here - ${introduction}your ${visit} today${time} with ${practitioners} is in ${appointment.suite}.${map}${directions}${reminder} Thank you - we’ll see you soon!`;
}
