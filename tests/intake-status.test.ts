import test from "node:test";
import assert from "node:assert/strict";
import { intakeStatusFromEvidence, type IntakeEvidence } from "../src/lib/intake-status.ts";

const appointmentId = "invented-appointment";
const intakeId = "invented-massage-intake-template";
const facialId = "invented-facial-intake-template";
const approved = [intakeId, facialId];
function completed(): IntakeEvidence {
  return { appointmentId, complete: true, pendingTemplates: [], forms: [
    { templateId: intakeId, kind: "client-form", state: "submitted", validForAppointment: true },
  ] };
}
const evaluate = (evidence?: IntakeEvidence | null) =>
  intakeStatusFromEvidence(appointmentId, approved, evidence);

test("completed intake plus unfinished SOAP chart is Complete", () => {
  const evidence = completed();
  evidence.pendingTemplates.push({ templateId: "invented-soap", kind: "chart" });
  evidence.forms.push({ templateId: "invented-soap", kind: "chart", state: "unfinished",
    validForAppointment: true });
  assert.equal(evaluate(evidence), "Complete");
});

test("an explicitly identified chart is excluded even if misconfigured into the intake allowlist", () => {
  const evidence = completed(); evidence.forms[0].kind = "chart";
  assert.equal(evaluate(evidence), "Unknown");
});

test("pending intake overrides an earlier completed copy", () => {
  const evidence = completed();
  evidence.pendingTemplates.push({ templateId: intakeId, kind: "client-form" });
  assert.equal(evaluate(evidence), "Incomplete");
});

test("started but unfinished intake is Incomplete", () => {
  const evidence = completed(); evidence.forms[0].state = "unfinished";
  assert.equal(evaluate(evidence), "Incomplete");
});

test("combined visit requires both applicable intakes", () => {
  const evidence = completed();
  evidence.pendingTemplates.push({ templateId: facialId, kind: "client-form" });
  assert.equal(evaluate(evidence), "Incomplete");
  evidence.pendingTemplates = [];
  evidence.forms.push({ templateId: facialId, kind: "client-form", state: "submitted",
    validForAppointment: true });
  assert.equal(evaluate(evidence), "Complete");
});

test("unrelated unfinished consent does not mark intake Incomplete", () => {
  const evidence = completed();
  evidence.pendingTemplates.push({ templateId: "invented-photo-consent", kind: "client-form" });
  assert.equal(evaluate(evidence), "Complete");
});

test("a missing or partially fetched snapshot never asserts a status", () => {
  assert.equal(evaluate(), "Unknown"); assert.equal(evaluate(null), "Unknown");
  const evidence = completed(); evidence.complete = false;
  assert.equal(evaluate(evidence), "Unknown");
});

test("a different appointment's completed intake cannot be reused without applicability verification", () => {
  const evidence = completed(); evidence.appointmentId = "invented-other-appointment";
  assert.equal(evaluate(evidence), "Unknown");
  evidence.appointmentId = appointmentId; evidence.forms[0].validForAppointment = false;
  assert.equal(evaluate(evidence), "Unknown");
});

test("archived or expired intake copies do not assert Complete", () => {
  const evidence = completed(); evidence.forms[0].state = "inactive";
  assert.equal(evaluate(evidence), "Unknown");
});

test("unknown form kind or status requires review", () => {
  const evidence = completed(); evidence.forms[0].kind = "unknown";
  assert.equal(evaluate(evidence), "Unknown");
  evidence.forms[0].kind = "client-form"; evidence.forms[0].state = "unknown";
  assert.equal(evaluate(evidence), "Unknown");
});

test("titles alone cannot enable matching and an empty allowlist stays disabled", () => {
  assert.equal(intakeStatusFromEvidence(appointmentId, [], completed()), "Unknown");
  const evidence = completed(); evidence.forms[0].templateId = "New Massage Client Intake Form";
  assert.equal(evaluate(evidence), "Unknown");
});

test("no applicable intake evidence is Unknown rather than implicitly Complete", () => {
  const evidence = completed(); evidence.forms = [];
  assert.equal(evaluate(evidence), "Unknown");
});

test("evaluation does not modify provider metadata or configuration", () => {
  const evidence = completed(); const before = structuredClone(evidence);
  evaluate(evidence); assert.deepEqual(evidence, before);
  assert.deepEqual(approved, [intakeId, facialId]);
});
