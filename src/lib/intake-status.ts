import type { IntakeStatus } from "./client-messages";

// Internal metadata contract, NOT a Boulevard GraphQL response type.
// A future approved server adapter must map documented API states, distinguish
// client forms from charts, and verify applicability to the current appointment.
// No form answers, clinical notes, names or credentials belong in this contract.
type TemplateMetadata = {
  templateId: string;
  kind: "client-form" | "chart" | "unknown";
};

export type IntakeEvidence = {
  appointmentId: string;
  // True only after both required-template and existing-form lists are fully read.
  complete: boolean;
  pendingTemplates: TemplateMetadata[];
  forms: Array<TemplateMetadata & {
    state: "submitted" | "unfinished" | "inactive" | "unknown";
    validForAppointment: boolean;
  }>;
};

export function intakeStatusFromEvidence(
  appointmentId: string,
  approvedIntakeTemplateIds: readonly string[],
  evidence?: IntakeEvidence | null,
): IntakeStatus {
  if (!appointmentId || !evidence || !evidence.complete ||
    evidence.appointmentId !== appointmentId || approvedIntakeTemplateIds.length === 0) {
    return "Unknown";
  }
  const approved = new Set(approvedIntakeTemplateIds);
  const pending = evidence.pendingTemplates.filter((item) =>
    approved.has(item.templateId) && item.kind !== "chart");
  const forms = evidence.forms.filter((item) => approved.has(item.templateId) &&
    item.kind !== "chart" && item.state !== "inactive" && item.validForAppointment);

  // A current unfulfilled requirement outweighs a historical completed copy.
  if (pending.some((item) => item.kind === "client-form") ||
    forms.some((item) => item.kind === "client-form" && item.state === "unfinished")) {
    return "Incomplete";
  }
  if (pending.length > 0 || forms.some((item) => item.kind === "unknown" ||
    !["submitted", "unfinished"].includes(item.state))) {
    return "Unknown";
  }
  return forms.some((item) => item.kind === "client-form" && item.state === "submitted") ?
    "Complete" : "Unknown";
}
