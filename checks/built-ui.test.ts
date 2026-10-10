import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Inspect the actual production prerender, with no sign-in or Boulevard request.
const html = readFileSync(new URL("../.next/server/app/index.html", import.meta.url), "utf8");
const selects = [...html.matchAll(/<select\b[^>]*>([\s\S]*?)<\/select>/g)].map((match) => match[1]);

test("built UI offers an editable unknown, complete and incomplete form status", () => {
  assert.ok(selects.some((select) => select.includes('value="Unknown"') &&
    select.includes('value="Complete"') && select.includes('value="Incomplete"')));
});

test("built UI offers both combined experience options", () => {
  assert.ok(selects.some((select) => select.includes('value="Massage &amp; Facial Experience"') &&
    select.includes('value="Combined Experience"')));
});

test("built practitioner dropdown excludes Rebecca", () => {
  const practitioner = selects.find((select) => select.includes('value="Peter"'));
  assert.ok(practitioner);
  assert.doesNotMatch(practitioner, /rebecca/i);
});

test("built draft does not invent an unnamed second practitioner", () => {
  assert.doesNotMatch(html, /and your second practitioner/i);
  assert.match(html, /Thank you/);
});
