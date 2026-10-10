import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canCopyMessage, generateText, greetingInBoise, INTAKE_REMINDER, GUEST_2_CONTACT_REQUEST, PRACTITIONERS,
  needsSecondPractitioner, practitionerOptions, type Appointment,
} from "../src/lib/client-messages.ts";
import {
  classifyAppointment, normalizeDailyAppointments,
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

for (const [instant, expected] of [
  ["2026-10-10T06:00:00Z", "Morning"], // Midnight MDT.
  ["2026-10-10T17:59:59Z", "Morning"],
  ["2026-10-10T18:00:00Z", "Afternoon"],
  ["2026-10-10T23:59:59Z", "Afternoon"],
  ["2026-10-11T00:00:00Z", "Hi"],
  ["2026-10-11T05:59:59Z", "Hi"],
  ["2026-01-10T18:59:59Z", "Morning"], // Winter MST.
  ["2026-01-10T19:00:00Z", "Afternoon"],
  ["2026-01-11T01:00:00Z", "Hi"],
  ["2026-03-08T09:00:00Z", "Morning"], // Spring clock change.
  ["2026-11-01T08:30:00Z", "Morning"], // Fall repeated hour.
] as const) {
  test(`Boise greeting at ${instant} is ${expected}`, () => {
    assert.equal(greetingInBoise(new Date(instant)), expected);
  });
}

test("invalid clock safely uses a neutral greeting", () => {
  assert.equal(greetingInBoise(new Date(NaN)), "Hi");
});

test("imports default to Auto independently of appointment time and location timezone", () => {
  assert.ok(normalizeDailyAppointments(pair(), "America/New_York").every(
    (appointment) => appointment.greetingTime === "Auto"));
});

test("Auto draft follows preparation time while manual greeting overrides remain unchanged", () => {
  const morning = new Date("2026-10-10T17:00:00Z");
  const afternoon = new Date("2026-10-10T20:00:00Z");
  const evening = new Date("2026-10-11T01:00:00Z");
  assert.match(generateText({ ...manual, greetingTime: "Auto", time: "7:00 PM" }, suite, morning), /^Good Morning/);
  assert.match(generateText({ ...manual, greetingTime: "Auto" }, suite, afternoon), /^Good Afternoon/);
  assert.match(generateText({ ...manual, greetingTime: "Auto" }, suite, evening), /^Hi /);
  for (const now of [morning, afternoon, evening]) {
    assert.match(generateText({ ...manual, greetingTime: "Morning" }, suite, now), /^Good Morning/);
    assert.match(generateText({ ...manual, greetingTime: "Afternoon" }, suite, now), /^Good Afternoon/);
    assert.match(generateText({ ...manual, greetingTime: "Hi" }, suite, now), /^Hi /);
  }
});

test("Rebecca is not a selectable practitioner, including imported full-name variants", () => {
  assert.ok(!PRACTITIONERS.includes("Rebecca"));
  for (const name of ["Rebecca", " rebecca ", "Rebecca Test"]) {
    assert.ok(!practitionerOptions(name).some((option) => /^rebecca/i.test(option)));
  }
  assert.ok(practitionerOptions("Alisha").includes("Alisha"));
});

for (const appointmentType of ["Standard", "Facial", "Couples Massage", "Massage & Facial Experience", "Combined Experience"] as const) {
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

for (const count of [0, 1, 2, undefined, null, -1, 0.5, NaN, Infinity]) {
  test(`aggregate count ${count} does not assert intake completion or trigger a reminder`, () => {
    const node = fixture("forms"); node.pendingFormCount = count;
    const [appointment] = imported([node]);
    assert.equal(appointment.intakeStatus, "Unknown");
    assert.equal(appointment.pendingFormCount,
      typeof count === "number" && Number.isSafeInteger(count) && count >= 0 ? count : null);
    assert.ok(!generateText(appointment, suite).includes(INTAKE_REMINDER));
  });
}

test("intake verification alert stays brief without changing the manual status choices", () => {
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Verify intake status and review the draft’s intake wording before copying\./);
  assert.doesNotMatch(page, /Check the applicable client intake form in Boulevard|not staff charts such as SOAP/);
  assert.match(page, /appointment\.intakeStatus === "Unknown"/);
  assert.match(page, /value="Complete"/); assert.match(page, /value="Incomplete"/);
});

test("staff can verify intake independently of aggregate count", () => {
  const node = fixture("forms"); node.pendingFormCount = 1;
  const [appointment] = imported([node]);
  assert.ok(!generateText({ ...appointment, intakeStatus: "Complete" }, suite).includes(INTAKE_REMINDER));
  assert.ok(generateText({ ...appointment, intakeStatus: "Incomplete" }, suite).includes(INTAKE_REMINDER));
});

test("each couples guest retains independent intake review and aggregate count", () => {
  const nodes = pair(); nodes[0].pendingFormCount = 1; nodes[1].pendingFormCount = 0;
  const appointments = imported(nodes);
  assert.deepEqual(appointments.map((appointment) => appointment.pendingFormCount), [1, 0]);
  assert.ok(appointments.every((appointment) => appointment.intakeStatus === "Unknown"));
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
  assert.equal(classifyAppointment(node), "Facial");
});

for (const addOn of [
  { name: "Microdermabrasion Add-On", category: { name: "Facial Add-Ons" } },
  { name: "Microdermabrasion", category: { name: "Facial Add Ons" } },
  { name: "Microdermabrasion Add–On", category: null },
  { name: "Facial Massage Enhancement", category: { name: "Massage" } },
  { name: "Microdermabrasion", category: { name: "Facials" } },
] as const) {
  test(`signature facial with ${addOn.name} in ${addOn.category?.name} remains a facial session`, () => {
    const node = fixture("facial-addon", 1, 3, "Meghan");
    node.startAt = node.appointmentServices[0].startAt = "2026-10-20T14:30:00-06:00";
    node.appointmentServices[0].service = { name: "EN Spa Signature Facial", category: { name: "Facials" } };
    const extra = structuredClone(node.appointmentServices[0]); extra.id = "invented-microdermabrasion";
    extra.service = addOn; node.appointmentServices.push(extra);
    const [appointment] = imported([node]);
    assert.equal(appointment.appointmentType, "Facial");
    assert.equal(needsSecondPractitioner(appointment), false);
    assert.equal(appointment.serviceSummary, `EN Spa Signature Facial + ${addOn.name}`);
    const text = generateText({ ...appointment, secondPractitioner: "Invented Other Staff" }, suite);
    assert.ok(text.includes("your facial session today at 2:30 PM with Meghan"));
    assert.doesNotMatch(text, /combined experience|couples massage|Invented Other Staff/i);
  });
}

test("a facial alone is a facial session without needing a second practitioner", () => {
  const node = fixture("single-facial");
  node.appointmentServices[0].service = { name: "EN Spa Signature Facial", category: null };
  assert.equal(classifyAppointment(node), "Facial");
});

test("massage plus facial add-on does not invent a Massage & Facial Experience", () => {
  const node = fixture("massage-addon");
  node.appointmentServices[0].service = { name: "Swedish Relaxation Massage", category: { name: "Massage" } };
  const extra = structuredClone(node.appointmentServices[0]); extra.id = "invented-facial-addon";
  extra.service = { name: "Facial Add-On", category: { name: "Facials" } };
  node.appointmentServices.push(extra);
  assert.equal(classifyAppointment(node), "Standard");
});

test("a facial plus an unidentified extra line is not enough evidence for a combined visit", () => {
  const node = fixture("unknown-extra");
  node.appointmentServices[0].service = { name: "Signature Facial", category: { name: "Facials" } };
  const extra = structuredClone(node.appointmentServices[0]); extra.id = "invented-unknown";
  extra.service = { name: "Unidentified Extra", category: null };
  node.appointmentServices.push(extra);
  assert.equal(classifyAppointment(node), "Facial");
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

function groupWithSeparateGuest() {
  const [group, separate] = pair();
  group.client = { firstName: "Invented First", lastName: null,
    mobilePhone: "202-555-0101", appointmentCount: 2 };
  separate.client = { firstName: "Invented Second", lastName: null,
    mobilePhone: "202-555-0102", appointmentCount: 1 };
  group.pendingFormCount = 1;
  separate.pendingFormCount = 0;
  const embedded = structuredClone(separate.appointmentServices[0]);
  embedded.id = "invented-group-guest-2-service";
  // Provider ordering must not swap Guest 1's and Guest 2's practitioner roles.
  group.appointmentServices.unshift(embedded);
  for (const node of [group, separate]) {
    node.startAt = "2026-10-20T21:30:00Z";
    node.endAt = "2026-10-20T22:30:00Z";
    node.appointmentServices.forEach((service) => { service.startAt = node.startAt; });
  }
  return [group, separate];
}

function couplesAddOn(node: AppointmentNode, name = "Deep Tissue Focus for 1",
  category: { name: string } | null = null) {
  const addon = structuredClone(node.appointmentServices.find((item) => /Guest 1/.test(item.service.name)) ||
    node.appointmentServices[0]);
  addon.id = "invented-couples-addon";
  addon.service = { name, category };
  return addon;
}

for (const order of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
  test(`explicit Mindy/Liann guest roles link without a group flag, provider order ${order}`, () => {
    const [group, separate] = groupWithSeparateGuest();
    group.isGroupedAppointment = false; separate.isGroupedAppointment = false;
    const guest1 = group.appointmentServices.find(item => /Guest 1/.test(item.service.name))!;
    const guest2 = group.appointmentServices.find(item => /Guest 2/.test(item.service.name))!;
    guest1.staff = fixture("explicit-first", 1, 6, "Mindy").appointmentServices[0].staff;
    guest2.staff = fixture("explicit-second", 2, 6, "Liann").appointmentServices[0].staff;
    separate.appointmentServices[0].staff = structuredClone(guest2.staff);
    group.appointmentServices.splice(1, 0, couplesAddOn(group));
    const ordinary = ordinaryFixture("between-explicit-guests", group.startAt);
    const nodes = [group, separate, ordinary]; const input = order.map(i => nodes[i]);
    const before = structuredClone(input); const appointments = imported(input);
    const couple = appointments.filter(item => item.appointmentType === "Couples Massage");
    assert.deepEqual(couple.map(item => item.appointmentId), [group.id, separate.id]);
    assert.equal(appointments.indexOf(couple[1]), appointments.indexOf(couple[0]) + 1);
    assert.deepEqual(couple.map(item => [item.practitioner, item.secondPractitioner]),
      [["Mindy", "Liann"], ["Liann", "Mindy"]]);
    assert.deepEqual(couple.map(item => item.partnerAppointmentId), [separate.id, group.id]);
    assert.ok(couple.every(item => canCopyMessage(item) && !item.importWarnings?.length));
    assert.deepEqual(input, before);
  });
}

for (const [label, mutate, reason] of [
  ["missing profile ID", (nodes: AppointmentNode[]) => { delete nodes[1].clientId; }, /client profile identifier is missing/i],
  ["same profile ID", (nodes: AppointmentNode[]) => { nodes[1].clientId = nodes[0].clientId; }, /same client profile/i],
  ["different staff ID despite matching names", (nodes: AppointmentNode[]) => {
    nodes[1].appointmentServices[0].staff.id = "invented-different-staff-id";
  }, /staff identifiers do not agree/i],
  ["missing staff ID", (nodes: AppointmentNode[]) => { delete nodes[0].appointmentServices[0].staff.id; }, /staff identifier is missing/i],
] as const) {
  test(`unlinked Guest 2 explains ${label} without exposing identifiers`, () => {
    const nodes = groupWithSeparateGuest(); mutate(nodes);
    const second = imported(nodes).find(item => item.appointmentId === nodes[1].id)!;
    assert.equal(second.secondPractitioner, ""); assert.equal(second.partnerAppointmentId, undefined);
    assert.match(second.importWarnings!.join(" "), reason);
    assert.doesNotMatch(second.importWarnings!.join(" "), /test-client-|test-staff-|invented-different-staff-id/);
  });
}

for (const order of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
  test(`3:30 grouped couples with Deep Tissue add-on links and sorts both clients for service order ${order}`, () => {
    const [group, separate] = groupWithSeparateGuest();
    const lines = [group.appointmentServices[1], couplesAddOn(group), group.appointmentServices[0]];
    group.appointmentServices = order.map((index) => lines[index]);
    const ordinary = ordinaryFixture("between-addon-couple", group.startAt);
    const input = [separate, ordinary, group]; const before = structuredClone(input);
    const appointments = imported(input);
    assert.deepEqual(appointments.map((item) => item.appointmentId), [group.id, separate.id, ordinary.id]);
    assert.deepEqual(appointments.slice(0, 2).map((item) => [item.practitioner, item.secondPractitioner]),
      [["Peter", "Mindy"], ["Mindy", "Peter"]]);
    assert.deepEqual(appointments.slice(0, 2).map((item) => item.partnerAppointmentId), [separate.id, group.id]);
    assert.ok(appointments.slice(0, 2).every((item) => item.guest2ProfileStatus === "Linked" &&
      canCopyMessage(item) && !item.importWarnings?.length));
    assert.match(appointments[0].serviceSummary, /^Couples 60 — Guest 1 · R6.* \+ Deep Tissue Focus for 1 \+ Couples 60 — Guest 2 · R6/);
    assert.equal(appointments[0].serviceSummary.split(" + ").length, 3);
    assert.deepEqual(appointments.slice(0, 2).map((item) => item.mobilePhone), ["202-555-0101", "202-555-0102"]);
    assert.deepEqual(appointments.slice(0, 2).map((item) => item.pendingFormCount), [1, 0]);
    assert.ok(appointments.slice(0, 2).every((item) => item.intakeStatus === "Unknown"));
    assert.deepEqual(input, before);
  });
}

for (const [name, category] of [
  ["Hot Stones for 1", { name: "Couples Massage Add-Ons" }],
  ["Deep Tissue Focus for 2", null],
  ["Aromatherapy Enhancement", null],
  ["Facial Add-On", { name: "Facials" }],
] as const) {
  test(`recognized ${name} does not block couples linkage or introduce an add-on practitioner`, () => {
    const nodes = groupWithSeparateGuest();
    const addon = couplesAddOn(nodes[0], name, category);
    addon.staff = fixture("addon-staff", 1, 6, "Liann").appointmentServices[0].staff;
    nodes[0].appointmentServices.unshift(addon);
    const appointments = imported(nodes);
    assert.deepEqual(appointments.map((item) => [item.practitioner, item.secondPractitioner]),
      [["Peter", "Mindy"], ["Mindy", "Peter"]]);
    assert.ok(appointments.every((item) => item.partnerAppointmentId && item.appointmentType === "Couples Massage"));
    assert.ok(appointments[0].serviceSummary.includes(name));
  });
}

test("separate Guest 2 with an add-on still matches the embedded Guest 2 staff", () => {
  const nodes = groupWithSeparateGuest();
  const addon = couplesAddOn(nodes[1], "Hot Stones for 2", { name: "Couples Massage Add-Ons" });
  addon.staff = fixture("addon-helper", 1, 6, "Liann").appointmentServices[0].staff;
  nodes[1].appointmentServices.unshift(addon);
  const appointments = imported(nodes);
  assert.equal(appointments[1].practitioner, "Mindy");
  assert.equal(appointments[1].secondPractitioner, "Peter");
  assert.equal(appointments[1].partnerAppointmentId, nodes[0].id);
});

test("grouped couples with add-on but no separate profile retains both staff and requests Guest 2 contact", () => {
  const [group] = groupWithSeparateGuest(); group.appointmentServices.push(couplesAddOn(group));
  const [appointment] = imported([group]);
  assert.equal(appointment.practitioner, "Peter"); assert.equal(appointment.secondPractitioner, "Mindy");
  assert.equal(appointment.guest2ProfileStatus, "Missing");
  assert.ok(generateText(appointment, suite).includes(GUEST_2_CONTACT_REQUEST));
});

test("unrelated add-on staff is not invented as Practitioner 2 on an unmatched one-guest card", () => {
  const node = fixture("unmatched-addon");
  const addon = couplesAddOn(node);
  addon.staff = fixture("addon-unrelated", 1, 6, "Liann").appointmentServices[0].staff;
  node.appointmentServices.unshift(addon);
  const [appointment] = imported([node]);
  assert.equal(appointment.practitioner, "Peter"); assert.equal(appointment.secondPractitioner, "");
  assert.equal(canCopyMessage(appointment), false);
});

for (const [label, mutate] of [
  ["unidentified extra service", (nodes: AppointmentNode[]) => {
    const extra = couplesAddOn(nodes[0], "Unidentified Treatment"); nodes[0].appointmentServices.push(extra);
  }],
  ["duplicate Guest 2 role", (nodes: AppointmentNode[]) => {
    nodes[0].appointmentServices.push(structuredClone(nodes[0].appointmentServices[0]));
  }],
  ["conflicting room", (nodes: AppointmentNode[]) => {
    nodes[0].appointmentServiceResources.push({ resource: { name: "Room 4" } });
  }],
  ["different partner staff", (nodes: AppointmentNode[]) => {
    nodes[1].appointmentServices[0].staff = fixture("other-addon-staff", 2, 6, "Liann").appointmentServices[0].staff;
  }],
  ["duplicate separate profiles", (nodes: AppointmentNode[]) => {
    const extra = structuredClone(nodes[1]); extra.id = "invented-extra-addon-appointment";
    extra.clientId = "invented-extra-addon-client"; nodes.push(extra);
  }],
] as const) {
  test(`add-on handling does not bypass ${label} ambiguity`, () => {
    const nodes = groupWithSeparateGuest();
    nodes[0].appointmentServices.push(couplesAddOn(nodes[0])); mutate(nodes);
    const appointments = imported(nodes);
    assert.ok(appointments.every((item) => !item.partnerAppointmentId));
    const separate = appointments.find((item) => item.appointmentId === nodes[1].id)!;
    assert.equal(separate.secondPractitioner, "");
    assert.ok(separate.importWarnings?.length);
  });
}

test("grouped two-guest booking links a separately created Guest 2 profile without merging cards", () => {
  const nodes = groupWithSeparateGuest(); const before = structuredClone(nodes);
  const appointments = imported(nodes);
  assert.equal(appointments.length, 2);
  assert.deepEqual(appointments.map((appointment) => appointment.clientName),
    ["Invented First", "Invented Second"]);
  assert.deepEqual(appointments.map((appointment) => appointment.mobilePhone),
    ["202-555-0101", "202-555-0102"]);
  assert.deepEqual(appointments.map((appointment) => appointment.clientType),
    ["Returning Client", "New Client"]);
  assert.deepEqual(appointments.map((appointment) => appointment.pendingFormCount), [1, 0]);
  assert.ok(appointments.every((appointment) => appointment.intakeStatus === "Unknown"));
  assert.deepEqual(appointments.map((appointment) => [appointment.practitioner, appointment.secondPractitioner]),
    [["Peter", "Mindy"], ["Mindy", "Peter"]]);
  assert.deepEqual(appointments.map((appointment) => appointment.partnerAppointmentId),
    [nodes[1].id, nodes[0].id]);
  assert.ok(appointments.every(canCopyMessage));
  assert.ok(appointments.every((appointment) => !appointment.importWarnings?.length));
  assert.match(generateText(appointments[0], suite), /Invented First,.*3:30 PM with Peter and Mindy/);
  assert.match(generateText(appointments[1], suite), /Invented Second,.*3:30 PM with Mindy and Peter/);
  assert.equal(appointments[0].serviceSummary.split(" + ").length, 2);
  assert.equal(appointments[1].serviceSummary.split(" + ").length, 1);
  const verifiedSecond = { ...appointments[1], intakeStatus: "Incomplete" as const };
  assert.ok(generateText(verifiedSecond, suite).includes(INTAKE_REMINDER));
  assert.ok(!generateText(appointments[0], suite).includes(INTAKE_REMINDER));
  assert.deepEqual(nodes, before);
});

test("grouped pair uses room suffixes and keeps own practitioner even when imported in reverse order", () => {
  const nodes = groupWithSeparateGuest();
  nodes.forEach((node) => { node.appointmentServiceResources = []; });
  const appointments = imported([...nodes].reverse());
  assert.ok(appointments.every((appointment) => appointment.suite === "Suite #4"));
  assert.deepEqual(appointments.map((appointment) => appointment.practitioner), ["Peter", "Mindy"]);
  assert.ok(appointments.every((appointment) => appointment.partnerAppointmentId));
});

test("same-client Guest 2 placeholder is not confused with the separately created client profile", () => {
  const nodes = groupWithSeparateGuest();
  const placeholder = structuredClone(nodes[1]); placeholder.id = "invented-placeholder-appointment";
  placeholder.clientId = nodes[0].clientId; placeholder.client = structuredClone(nodes[0].client);
  nodes.push(placeholder);
  const appointments = imported(nodes);
  assert.equal(appointments.length, 3); // Never hide or delete the provider's placeholder.
  assert.equal(appointments[0].partnerAppointmentId, nodes[1].id);
  assert.equal(appointments[1].partnerAppointmentId, nodes[0].id);
  assert.equal(appointments[2].partnerAppointmentId, undefined);
  assert.equal(canCopyMessage(appointments[2]), false);
});

test("separate original Guest 1 and placeholder Guest 2 records can link the new Guest 2 profile", () => {
  const nodes = pair();
  const separate = structuredClone(nodes[1]); separate.id = "invented-separate-guest-2";
  separate.clientId = "invented-separate-client";
  nodes[1].clientId = nodes[0].clientId; nodes.push(separate);
  const appointments = imported(nodes);
  assert.equal(appointments[0].partnerAppointmentId, separate.id);
  const placeholder = appointments.find((appointment) => appointment.appointmentId === nodes[1].id)!;
  const guest2 = appointments.find((appointment) => appointment.appointmentId === separate.id)!;
  assert.equal(guest2.partnerAppointmentId, nodes[0].id);
  assert.equal(placeholder.partnerAppointmentId, undefined);
});

for (const [label, mutate] of [
  ["different separate Guest 2 staff", (nodes: AppointmentNode[]) => {
    nodes[1].appointmentServices[0].staff = fixture("other-staff", 2, 6, "Liann").appointmentServices[0].staff;
  }],
  ["same client profile", (nodes: AppointmentNode[]) => { nodes[1].clientId = nodes[0].clientId; }],
  ["missing separate client ID", (nodes: AppointmentNode[]) => { delete nodes[1].clientId; }],
  ["missing grouped client ID", (nodes: AppointmentNode[]) => { delete nodes[0].clientId; }],
  ["duplicate separate Guest 2 profiles", (nodes: AppointmentNode[]) => {
    const extra = structuredClone(nodes[1]); extra.id = "invented-extra-appointment";
    extra.clientId = "invented-extra-client"; nodes.push(extra);
  }],
  ["different embedded Guest 2 time", (nodes: AppointmentNode[]) => {
    nodes[0].appointmentServices[0].startAt = "2026-10-20T21:45:00Z";
  }],
  ["different embedded service duration", (nodes: AppointmentNode[]) => {
    nodes[0].appointmentServices[0].service.name = nodes[0].appointmentServices[0].service.name.replace("60", "90");
  }],
  ["two embedded Guest 1 roles", (nodes: AppointmentNode[]) => {
    nodes[0].appointmentServices[0].service.name = nodes[0].appointmentServices[0].service.name.replace("Guest 2", "Guest 1");
  }],
  ["additional grouped service", (nodes: AppointmentNode[]) => {
    nodes[0].appointmentServices.push(structuredClone(nodes[0].appointmentServices[0]));
  }],
  ["conflicting grouped room resource", (nodes: AppointmentNode[]) => {
    nodes[0].appointmentServiceResources.push({ resource: { name: "Room 4" } });
  }],
] as const) {
  for (const groupedFlag of [true, false]) {
    test(`two-role couples association refuses ${label} with group flag ${groupedFlag}`, () => {
      const nodes = groupWithSeparateGuest(); nodes[0].isGroupedAppointment = groupedFlag;
      mutate(nodes); const appointments = imported(nodes);
      assert.ok(appointments.every((appointment) => !appointment.partnerAppointmentId));
      assert.equal(appointments[1].secondPractitioner, "");
      assert.equal(canCopyMessage(appointments[1]), false);
      assert.ok(appointments[1].importWarnings?.length);
    });
  }
}

test("conflicting external assignment warns on the grouped card without replacing observed staff", () => {
  const nodes = groupWithSeparateGuest();
  nodes[1].appointmentServices[0].staff = fixture("other", 2, 6, "Liann").appointmentServices[0].staff;
  const [group] = imported(nodes);
  assert.equal(group.practitioner, "Peter"); assert.equal(group.secondPractitioner, "Mindy");
  assert.match(group.importWarnings![0], /different staff assignment/);
});

test("cancelled separate Guest 2 record is never linked", () => {
  const nodes = groupWithSeparateGuest(); nodes[1].cancelled = true;
  const [group] = imported(nodes);
  assert.equal(group.partnerAppointmentId, undefined);
  assert.equal(group.practitioner, "Peter"); assert.equal(group.secondPractitioner, "Mindy");
});

test("UI labels the linked client card without mixing contact details or intake review", () => {
  const source = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /other\.appointmentId === appointment\.partnerAppointmentId/);
  assert.match(source, /Couples partner: \{couplesPartner\.clientName\}/);
  assert.match(source, /Each text uses its own client’s contact details and intake review/);
});

for (const clientType of ["New Client", "Returning Client"] as const) {
  for (const intakeStatus of ["Unknown", "Complete", "Incomplete"] as const) {
    test(`unprofiled grouped couples includes exact Guest 2 request before thank-you for ${clientType}, ${intakeStatus}`, () => {
      const [node] = groupWithSeparateGuest(); node.client.appointmentCount = clientType === "New Client" ? 1 : 2;
      const [appointment] = imported([node]);
      assert.equal(appointment.guest2ProfileStatus, "Missing");
      const text = generateText({ ...appointment, intakeStatus }, suite);
      assert.ok(text.endsWith(`${GUEST_2_CONTACT_REQUEST} Thank you - we’ll see you soon!`));
      assert.equal(text.split(GUEST_2_CONTACT_REQUEST).length, 2);
      assert.ok(!text.includes(INTAKE_REMINDER)); // The requested paragraph covers both intakes.
    });
  }
}

test("linked Guest 2 suppresses the contact request on both cards", () => {
  const appointments = imported(groupWithSeparateGuest());
  assert.ok(appointments.every((appointment) => appointment.guest2ProfileStatus === "Linked"));
  for (const appointment of appointments) {
    const text = generateText({ ...appointment, intakeStatus: "Incomplete" }, suite);
    assert.ok(!text.includes(GUEST_2_CONTACT_REQUEST));
    assert.ok(text.includes(INTAKE_REMINDER));
  }
});

test("same-client placeholder produces a Guest 2 contact request only on the Guest 1 card", () => {
  const nodes = pair(); nodes[1].clientId = nodes[0].clientId;
  const appointments = imported(nodes);
  assert.equal(appointments[0].guest2ProfileStatus, "Missing");
  assert.equal(appointments[1].guest2ProfileStatus, "Unknown");
  assert.ok(generateText(appointments[0], suite).includes(GUEST_2_CONTACT_REQUEST));
  assert.ok(!generateText(appointments[1], suite).includes(GUEST_2_CONTACT_REQUEST));
});

for (const [label, mutate] of [
  ["mismatched staff", (nodes: AppointmentNode[]) => {
    nodes[1].appointmentServices[0].staff = fixture("other", 2, 6, "Liann").appointmentServices[0].staff;
  }],
  ["missing external staff ID", (nodes: AppointmentNode[]) => { delete nodes[1].appointmentServices[0].staff.id; }],
  ["missing external client ID", (nodes: AppointmentNode[]) => { delete nodes[1].clientId; }],
  ["missing booking client ID", (nodes: AppointmentNode[]) => { delete nodes[0].clientId; }],
  ["ambiguous external room", (nodes: AppointmentNode[]) => {
    nodes[1].appointmentServiceResources.push({ resource: { name: "Room 4" } });
  }],
  ["duplicate Guest 2 profiles", (nodes: AppointmentNode[]) => {
    const extra = structuredClone(nodes[1]); extra.id = "invented-duplicate-guest";
    extra.clientId = "invented-duplicate-client"; nodes.push(extra);
  }],
] as const) {
  test(`uncertain Guest 2 profile with ${label} never sends a false contact request`, () => {
    const nodes = groupWithSeparateGuest(); mutate(nodes);
    const [appointment] = imported(nodes);
    assert.equal(appointment.guest2ProfileStatus, "Unknown");
    assert.ok(!generateText(appointment, suite).includes(GUEST_2_CONTACT_REQUEST));
  });
}

test("a lone Guest 1 service or group flag does not establish a missing Guest 2 profile", () => {
  const [appointment] = imported([fixture("lone")]);
  assert.equal(appointment.guest2ProfileStatus, "Unknown");
  assert.ok(!generateText(appointment, suite).includes(GUEST_2_CONTACT_REQUEST));
});

test("an unrelated separate Guest 2 visit does not suppress the grouped visit's contact request", () => {
  const nodes = groupWithSeparateGuest();
  nodes[1].appointmentServices[0].service.name = nodes[1].appointmentServices[0].service.name.replace("60", "90");
  const [appointment] = imported(nodes);
  assert.equal(appointment.guest2ProfileStatus, "Missing");
});

test("staff can suppress or include Guest 2 wording without changing records", () => {
  const [node] = groupWithSeparateGuest(); const [appointment] = imported([node]);
  for (const guest2ProfileStatus of ["Linked", "Unknown"] as const) {
    assert.ok(!generateText({ ...appointment, guest2ProfileStatus }, suite).includes(GUEST_2_CONTACT_REQUEST));
  }
  assert.ok(generateText({ ...manual, appointmentType: "Couples Massage",
    guest2ProfileStatus: "Missing" }, suite).includes(GUEST_2_CONTACT_REQUEST));
});

test("changing a card away from couples never includes stale Guest 2 wording", () => {
  for (const appointmentType of ["Standard", "Facial", "Massage & Facial Experience", "Combined Experience"] as const) {
    const text = generateText({ ...manual, appointmentType, guest2ProfileStatus: "Missing",
      intakeStatus: "Incomplete" }, suite);
    assert.ok(!text.includes(GUEST_2_CONTACT_REQUEST)); assert.ok(text.includes(INTAKE_REMINDER));
  }
});

test("UI offers an independent Guest 2 contact-request override", () => {
  const source = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /updateAppointment\(index, "guest2ProfileStatus", e.target.value\)/);
  assert.match(source, /Missing — request name and cell/);
  assert.match(source, /Has separate profile — no contact request/);
});

function ordinaryFixture(id: string, startAt = "2026-10-20T16:00:00Z") {
  const node = fixture(id, 1, 3, "Meghan");
  node.isGroupedAppointment = false;
  node.startAt = node.appointmentServices[0].startAt = startAt;
  node.appointmentServices[0].service = { name: "Signature Facial", category: { name: "Facials" } };
  return node;
}

for (const order of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
  test(`couples display stays adjacent with Guest 1 first for provider order ${order.join(",")}`, () => {
    const nodes = [...pair(), ordinaryFixture("ordinary")];
    nodes[0].client.firstName = "Invented First"; nodes[0].client.mobilePhone = "202-555-0101";
    nodes[1].client.firstName = "Invented Second"; nodes[1].client.mobilePhone = "202-555-0102";
    nodes[0].pendingFormCount = 1; nodes[1].pendingFormCount = 0;
    const input = order.map((index) => nodes[index]); const before = structuredClone(input);
    const baseline = imported(nodes);
    const appointments = imported(input);
    const ids = appointments.map((appointment) => appointment.appointmentId);
    const first = ids.indexOf(nodes[0].id);
    assert.equal(ids[first + 1], nodes[1].id);
    assert.equal(ids.length, 3); assert.equal(new Set(ids).size, 3);
    assert.equal(ids.indexOf(nodes[2].id), order[0] === 2 ? 0 : 2);
    for (const appointment of appointments) {
      const expected = baseline.find((other) => other.appointmentId === appointment.appointmentId)!;
      assert.deepEqual(appointment, expected);
      assert.equal(generateText(appointment, suite), generateText(expected, suite));
    }
    assert.deepEqual(input, before);
  });
}

test("two simultaneous couples remain in their own room-specific blocks", () => {
  const room6 = pair();
  const room4 = [fixture("room4-first", 1, 4, "Liann"), fixture("room4-second", 2, 4, "Tiffany")];
  const ordinary = ordinaryFixture("same-time");
  const appointments = imported([room4[1], ordinary, room6[1], room4[0], room6[0]]);
  assert.deepEqual(appointments.map((appointment) => appointment.appointmentId),
    [room4[0].id, room4[1].id, ordinary.id, room6[0].id, room6[1].id]);
  assert.equal(appointments[0].partnerAppointmentId, room4[1].id);
  assert.equal(appointments[3].partnerAppointmentId, room6[1].id);
});

test("earlier and later ordinary appointments keep chronological order around the pair", () => {
  const nodes = pair();
  const earlier = ordinaryFixture("earlier", "2026-10-20T15:00:00Z");
  const later = ordinaryFixture("later", "2026-10-20T17:00:00Z");
  assert.deepEqual(imported([later, nodes[1], earlier, nodes[0]])
    .map((appointment) => appointment.appointmentId), [earlier.id, nodes[0].id, nodes[1].id, later.id]);
});

test("grouped booking and separate Guest 2 are adjacent and grouped summary starts with Guest 1", () => {
  const [group, separate] = groupWithSeparateGuest();
  const ordinary = ordinaryFixture("between", group.startAt);
  const appointments = imported([separate, ordinary, group]);
  assert.deepEqual(appointments.map((appointment) => appointment.appointmentId), [group.id, separate.id, ordinary.id]);
  assert.match(appointments[0].serviceSummary, /^Couples 60 — Guest 1 · R6.* \+ Couples 60 — Guest 2 · R6/);
});

test("same-client placeholder stays adjacent without becoming a linked client profile", () => {
  const nodes = pair(); nodes[1].clientId = nodes[0].clientId;
  const ordinary = ordinaryFixture("between-placeholder");
  const appointments = imported([nodes[1], ordinary, nodes[0]]);
  assert.deepEqual(appointments.map((appointment) => appointment.appointmentId), [nodes[0].id, nodes[1].id, ordinary.id]);
  assert.ok(appointments.every((appointment) => !appointment.partnerAppointmentId));
  assert.equal(appointments[0].guest2ProfileStatus, "Missing");
  assert.ok(generateText(appointments[0], suite).includes(GUEST_2_CONTACT_REQUEST));
  assert.equal(canCopyMessage(appointments[1]), false);
});

test("unmatched couples are not globally sorted by guest number or suite", () => {
  const first = fixture("unmatched-first", 1, 4, "Peter");
  const second = fixture("unmatched-second", 2, 6, "Mindy");
  const ordinary = ordinaryFixture("between-unmatched");
  assert.deepEqual(imported([second, ordinary, first]).map((appointment) => appointment.appointmentId),
    [second.id, ordinary.id, first.id]);
});

test("ambiguous couples candidates keep their stable order instead of inventing adjacency", () => {
  const nodes = pair(); const extra = fixture("ambiguous", 2, 6, "Liann");
  const ordinary = ordinaryFixture("between-ambiguous");
  const input = [nodes[1], ordinary, extra, nodes[0]];
  const appointments = imported(input);
  assert.deepEqual(appointments.map((appointment) => appointment.appointmentId), input.map((node) => node.id));
  assert.ok(appointments.every((appointment) => !appointment.partnerAppointmentId));
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
