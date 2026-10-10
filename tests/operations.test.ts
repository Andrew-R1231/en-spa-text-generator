import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canCopyMessage, generateText, INTAKE_REMINDER, PRACTITIONERS,
  practitionerOptions, type Appointment,
} from "../src/lib/client-messages.ts";
import {
  classifyAppointment, intakeStatusFromCount, normalizeDailyAppointments,
  type AppointmentNode,
} from "../src/lib/appointment-import.ts";

const suite = { mapUrl: "https://example.test/map", directions: "Invented directions.",
  imageLabel: "Test suite", imageUrl: "https://example.test/image" };
const manual: Appointment = {
  clientName: "Test Guest", mobilePhone: "", clientType: "New Client",
  appointmentType: "Standard", greetingTime: "Hi", practitioner: "Peter",
  secondPractitioner: "", suite: "Suite #1", time: "10:00 AM", serviceSummary: "",
  intakeStatus: "Unknown",
};

function fixture(id: string, guest = 1, room = 6, practitioner = "Peter"): AppointmentNode {
  return {
    id: `test-appointment-${id}`, clientId: `test-client-${id}`,
    startAt: "2026-10-20T16:00:00Z", endAt: "2026-10-20T17:00:00Z",
    cancelled: false, isGroupedAppointment: true, pendingFormCount: 0,
    client: { firstName: "Invented Guest", lastName: null, mobilePhone: null, appointmentCount: 2 },
    appointmentServices: [{ id: `test-service-${id}`, startAt: "2026-10-20T16:00:00Z",
      staff: { id: `test-staff-${practitioner}`, displayName: practitioner,
        firstName: practitioner, name: practitioner },
      service: { name: `Couples 60 — Guest ${guest} · R${room} (Do Not Book Separately)`,
        category: { name: "Assisted Booking Components" } } }],
    appointmentServiceResources: [{ resource: { name: `Room ${room}` } }],
  };
}

function pair() { return [fixture("a", 1, 6, "Peter"), fixture("b", 2, 6, "Mindy")]; }
const imported = (nodes: AppointmentNode[]) => normalizeDailyAppointments(nodes, "America/Boise");

test("Rebecca is not a selectable practitioner, including imported full-name variants", () => {
  assert.ok(!PRACTITIONERS.includes("Rebecca"));
  for (const name of ["Rebecca", " rebecca ", "Rebecca Test"]) {
    assert.ok(!practitionerOptions(name).some((option) => /^rebecca/i.test(option)));
  }
  assert.ok(practitionerOptions("Alisha").includes("Alisha"));
});

for (const appointmentType of ["Standard", "Couples Massage", "Massage & Facial Experience", "Combined Experience"] as const) {
  for (const clientType of ["New Client", "Returning Client"] as const) {
    test(`intake reminder precedes thank-you for ${appointmentType}, ${clientType}`, () => {
      const text = generateText({ ...manual, appointmentType, clientType,
        secondPractitioner: "Mindy", intakeStatus: "Incomplete" }, suite);
      assert.ok(text.includes(`${INTAKE_REMINDER} Thank you - we’ll see you soon!`));
      assert.equal(text.split(INTAKE_REMINDER).length, 2);
      assert.equal(text.includes("Invented directions."), clientType === "New Client");
    });
  }
}

for (const intakeStatus of ["Unknown", "Complete"] as const) {
  test(`${intakeStatus} does not falsely generate an incomplete-form reminder`, () => {
    assert.ok(!generateText({ ...manual, intakeStatus }, suite).includes(INTAKE_REMINDER));
  });
}

test("pending count maps to editable form status without conflating absent with complete", () => {
  assert.equal(intakeStatusFromCount(0), "Complete");
  assert.equal(intakeStatusFromCount(2), "Incomplete");
  for (const count of [undefined, null, -1, 0.5, NaN, Infinity]) {
    assert.equal(intakeStatusFromCount(count), "Unknown");
  }
  const node = fixture("forms"); node.pendingFormCount = 2;
  const [appointment] = imported([node]);
  assert.equal(appointment.pendingFormCount, 2);
  assert.equal(appointment.intakeStatus, "Incomplete");
  assert.ok(generateText(appointment, suite).includes(INTAKE_REMINDER));
});

test("ordinary sessions ignore a stale second practitioner", () => {
  assert.ok(!generateText({ ...manual, secondPractitioner: "Liann" }, suite).includes("Liann"));
});

test("linked couples use each guest's own practitioner plus their matched partner", () => {
  const nodes = pair(); const appointments = imported(nodes);
  assert.equal(appointments[0].practitioner, "Peter");
  assert.equal(appointments[0].secondPractitioner, "Mindy");
  assert.equal(appointments[1].practitioner, "Mindy");
  assert.equal(appointments[1].secondPractitioner, "Peter");
  assert.equal(appointments[0].partnerAppointmentId, nodes[1].id);
  assert.equal(appointments[1].partnerAppointmentId, nodes[0].id);
  assert.ok(generateText(appointments[0], suite).includes("with Peter and Mindy"));
  assert.ok(!generateText(appointments[0], suite).includes("second practitioner"));
  assert.ok(appointments.every(canCopyMessage));
});

test("input records are not mutated", () => {
  const nodes = pair(); const before = structuredClone(nodes);
  imported(nodes); assert.deepEqual(nodes, before);
});

for (const [label, mutate] of [
  ["different rooms in the same suite", (nodes: AppointmentNode[]) => {
    nodes[1] = fixture("b", 2, 4, "Mindy");
  }],
  ["different service times", (nodes: AppointmentNode[]) => {
    nodes[1].appointmentServices[0].startAt = "2026-10-20T16:15:00Z";
  }],
  ["different dates at the same clock time", (nodes: AppointmentNode[]) => {
    nodes[1].startAt = nodes[1].appointmentServices[0].startAt = "2026-10-21T16:00:00Z";
  }],
  ["different duration families", (nodes: AppointmentNode[]) => {
    nodes[1].appointmentServices[0].service.name = nodes[1].appointmentServices[0].service.name.replace("60", "90");
  }],
  ["same guest number", (nodes: AppointmentNode[]) => {
    nodes[1].appointmentServices[0].service.name = nodes[1].appointmentServices[0].service.name.replace("Guest 2", "Guest 1");
  }],
  ["same client", (nodes: AppointmentNode[]) => { nodes[1].clientId = nodes[0].clientId; }],
  ["same staff", (nodes: AppointmentNode[]) => { nodes[1].appointmentServices[0].staff = nodes[0].appointmentServices[0].staff; }],
  ["unknown staff ID", (nodes: AppointmentNode[]) => { delete nodes[1].appointmentServices[0].staff.id; }],
  ["conflicting room suffix and resource", (nodes: AppointmentNode[]) => {
    nodes[1].appointmentServiceResources = [{ resource: { name: "Room 4" } }];
  }],
  ["multiple room resources", (nodes: AppointmentNode[]) => {
    nodes[1].appointmentServiceResources.push({ resource: { name: "Room 5" } });
  }],
  ["multiple matching partners", (nodes: AppointmentNode[]) => {
    nodes.push(fixture("c", 2, 6, "Liann"));
  }],
] as const) {
  test(`couples pairing refuses ${label}`, () => {
    const nodes = pair(); mutate(nodes); const appointments = imported(nodes);
    assert.equal(appointments[0].secondPractitioner, "");
    assert.equal(appointments[0].partnerAppointmentId, undefined);
    assert.ok(appointments[0].importWarnings?.length);
    assert.equal(canCopyMessage(appointments[0]), false);
  });
}

test("cancelled partner is excluded and manual practitioner review unlocks copying", () => {
  const nodes = pair(); nodes[1].cancelled = true;
  const appointments = imported(nodes);
  assert.equal(appointments.length, 1);
  assert.equal(canCopyMessage(appointments[0]), false);
  assert.equal(canCopyMessage({ ...appointments[0], secondPractitioner: "Mindy" }), true);
});

test("equivalent ISO timestamps and Room/Couples Room resources match", () => {
  const nodes = pair(); nodes[1].appointmentServices[0].startAt = "2026-10-20T10:00:00-06:00";
  nodes[1].appointmentServiceResources = [{ resource: { name: "Couples Room 6" } }];
  assert.equal(imported(nodes)[0].secondPractitioner, "Mindy");
});

test("room-specific suffix can match without a room resource; equipment is not a room", () => {
  const nodes = pair();
  for (const node of nodes) node.appointmentServiceResources = [{ resource: { name: "Light Therapy System 4" } }];
  const appointments = imported(nodes);
  assert.equal(appointments[0].secondPractitioner, "Mindy");
  assert.ok(appointments.every((appointment) => appointment.suite === "Suite #4"));
});

for (const room of [1, 2, 3, 4, 5, 6]) {
  test(`couples R${room} suffix routes to the correct suite without a room resource`, () => {
    const node = fixture(`suffix-room-${room}`, 1, room);
    node.appointmentServiceResources = [];
    assert.equal(imported([node])[0].suite, room <= 3 ? "Suite #1" : "Suite #4");
  });
}

test("multiple suffix rooms are not guessed into a suite or couples pair", () => {
  const nodes = pair();
  nodes.forEach((node) => {
    node.appointmentServiceResources = [];
    node.appointmentServices[0].service.name += " / R4";
  });
  const appointments = imported(nodes);
  assert.ok(appointments.every((appointment) => appointment.partnerAppointmentId === undefined));
  assert.ok(appointments.every((appointment) => !canCopyMessage(appointment)));
});

test("daily records sort by actual start instant across timestamp offsets", () => {
  const earlier = fixture("earlier");
  const later = fixture("later");
  earlier.startAt = "2026-10-20T16:00:00Z";
  later.startAt = "2026-10-20T11:00:00-06:00";
  assert.deepEqual(imported([later, earlier]).map((appointment) => appointment.appointmentId),
    [earlier.id, later.id]);
});

test("original Couples Massage service names pair using the room resource", () => {
  const nodes = pair();
  nodes.forEach((node, index) => {
    node.appointmentServices[0].service.name = `Couples Massage (60-Minutes) - Guest ${index + 1}`;
  });
  assert.equal(imported(nodes)[0].secondPractitioner, "Mindy");
});

test("massage plus facial is not couples even with group flag and two staff", () => {
  const node = fixture("experience");
  const massage = node.appointmentServices[0]; massage.service.name = "Therapeutic 60-Minute Massage";
  massage.service.category = { name: "Massage" };
  const facial = structuredClone(massage); facial.id = "test-facial";
  facial.startAt = "2026-10-20T17:15:00Z";
  facial.staff = { id: "test-staff-Meghan", displayName: "Meghan", firstName: "Meghan", name: "Meghan" };
  facial.service = { name: "Lymphatic Renewal Facial", category: { name: "Facials" } };
  node.appointmentServices = [facial, massage];
  const [appointment] = imported([node]);
  assert.equal(appointment.appointmentType, "Massage & Facial Experience");
  assert.equal(appointment.practitioner, "Peter");
  assert.equal(appointment.secondPractitioner, "Meghan");
  const text = generateText(appointment, suite);
  assert.ok(text.includes("your Massage & Facial Experience"));
  assert.ok(text.includes("Peter and Meghan"));
  assert.ok(!text.includes("couples massage"));
});

test("a single named Massage & Facial Experience is classified correctly", () => {
  const node = fixture("named"); node.appointmentServices[0].service.name = "Massage & Facial Experience";
  assert.equal(classifyAppointment(node), "Massage & Facial Experience");
});

test("two practitioners or a group flag alone no longer imply couples", () => {
  const node = fixture("ordinary"); node.appointmentServices[0].service.name = "Therapeutic Massage";
  const second = structuredClone(node.appointmentServices[0]); second.staff.displayName = "Mindy";
  node.appointmentServices.push(second);
  assert.equal(classifyAppointment(node), "Standard");
});

test("a facial mentioning a Couples Room is not a couples massage", () => {
  const node = fixture("room-wording");
  node.appointmentServices[0].service.name = "Renewal Facial — Couples Room 6";
  assert.equal(classifyAppointment(node), "Standard");
});

test("manually choosing the same practitioner twice still requires review", () => {
  assert.equal(canCopyMessage({ ...manual, appointmentType: "Couples Massage",
    secondPractitioner: " peter " }), false);
});

test("an already combined couples record preserves both observed practitioners", () => {
  const nodes = pair(); nodes[0].appointmentServices.push(nodes[1].appointmentServices[0]);
  const [appointment] = imported([nodes[0]]);
  assert.equal(appointment.secondPractitioner, "Mindy");
  assert.equal(canCopyMessage(appointment), true);
});

test("body plus facial has a neutral combined-experience foundation", () => {
  const node = fixture("reset"); node.appointmentServices[0].service.name = "Complete Lymphatic Reset — Body Component";
  const second = structuredClone(node.appointmentServices[0]); second.service.name = "Lymphatic Renewal Facial";
  node.appointmentServices.push(second);
  assert.equal(classifyAppointment(node), "Combined Experience");
});

for (const room of [1, 2, 3, 4, 5, 6]) {
  test(`room ${room} retains the original suite mapping`, () => {
    assert.equal(imported([fixture(`room-${room}`, 1, room)])[0].suite, room <= 3 ? "Suite #1" : "Suite #4");
  });
}

test("integration requests pending count and IDs but no form contents or mutations", () => {
  const source = readFileSync(new URL("../src/lib/boulevard.ts", import.meta.url), "utf8");
  assert.match(source, /pendingFormCount/);
  assert.match(source, /staff \{ id displayName firstName name \}/);
  assert.match(source, /clientId/);
  assert.match(source, /normalizeDailyAppointments\(nodes, location.tz\)/);
  assert.doesNotMatch(source, /\bmutation\b|customForms|reserveCart|bookingComplete/);
});
