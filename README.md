# EN Spa Operations

Internal EN Spa tools for preparing daily client text messages.

## Local implementation and validation

These changes were prepared from `C:\Users\andre\en-spa-text-generator`,
branch `en-spa-operations` at commit `8c5e048`, in a separate local review workspace.
Environment files, credentials, Git metadata and Vercel project links were not
copied into that workspace. Local verification uses invented fixtures and does
not access client records. A successful local build is not a deployment or a
connected Boulevard test; production rollout requires separate approval.

## Message and import behavior

New and imported drafts default to Auto (Boise time): Good Morning before noon,
Good Afternoon from noon until 6 p.m., and Hi afterward. This uses the current
message-preparation time in America/Boise, not the appointment time or the device's
timezone. Auto updates while the page is open and on return to the tab. Selecting
Morning, Afternoon or Hi overrides Auto for that card; clock updates do not change
manual selections. Reimporting replaces the cards and resets them to Auto.

Rebecca is removed from practitioner choices. An imported appointment containing
that name retains its observed practitioner in the draft and displays a review
notice; the app never silently assigns a replacement practitioner.

The Intake form selector controls the reminder immediately before the thank-you
sentence. Imported intake status defaults to Needs verification, regardless of
`pendingFormCount`. That aggregate count does not identify the pending item and
cannot establish intake completion. Its treatment of charts is not explicitly
documented in the [legacy Appointment reference](https://developers.joinblvd.com/graphql-admin-api/api-reference/types/Appointment).
Staff must check the applicable client intake, excluding staff charts such as
SOAP, and select Complete or Incomplete before copying. Unknown drafts contain
no individual incomplete-intake reminder and display a review warning; copying is
not blocked by intake status. The separate Guest 2 contact request below can still
appear when intake status is Unknown.
Reimporting replaces all cards and manual selections. No form contents or answers
are requested.

### Intake metadata integration

The local `intake-status.ts` evaluator provides tested rules for a future server
adapter. It matches approved template IDs, excludes charts, checks current
appointment applicability, and leaves missing or partial evidence Unknown.
An outstanding intake requirement overrides an earlier submitted copy. An expired
or archived copy alone does not establish completion. Titles help identify the
templates during configuration; they are not used as a substitute for stable IDs.

The evaluator is not connected to the live import. The current legacy query and
credentials are unchanged. Boulevard's [2026-06 changelog](https://developers.joinblvd.com/2026-06/changelog)
documents appointment `pendingFormTemplates(format:)` and `customForms` under
`form:read`, with internal charts included only by the ALL pending-template filter.
Connecting these fields requires the supported API/authentication setup and
explicit approval to add `form:read`; the previously approved appointment scopes
do not cover this access. Only template identification, form kind, completion and
applicability metadata should be queried. Form answers and clinical notes are out
of scope. Verify exact wire fields, enum meanings, expiration/reuse and staff
review semantics in sandbox before mapping them into the internal contract.

Separate couples appointments are paired only when they have an unambiguous
mutual match on room number, exact service start instant and service-name family
including duration. Guest 1 and Guest 2 markers must be complementary when
present. Different staff IDs are required; known identical client IDs are rejected.
Room resources and `R6`-style suffixes must agree. The app never matches on suite
or display clock time alone. When a room resource is absent, a single room suffix
on a couples service also supplies the suite mapping. A missing, cancelled, conflicting or ambiguous partner
leaves Practitioner 2 blank and disables Copy Text until staff verifies two
different practitioner names. Each guest retains their own card, contact details
and form status; no bookings are merged or modified.

A grouped record containing exactly Guest 1 and Guest 2 can also link to a
separate Guest 2 appointment created for a different client profile. Both service
lines must agree on room, start instant and service family; the separate Guest 2
record must agree with the grouped Guest 2 staff ID. Both client IDs must be
present and different, and the match must be unique in both directions. Guest
roles determine practitioner order even if the provider returns Guest 2 first.
Each card displays its linked couples partner while retaining its own phone
number, client type, intake review and service summary. Each text lists that
client's practitioner first and their partner's practitioner second.

Matched couples cards are displayed together, with explicit Guest 1 immediately
before Guest 2, regardless of provider ordering or interleaved appointments. Each
pair occupies the position of its earliest card in the chronological day list;
unrelated appointments retain their relative order. An unambiguous same-client
Guest 1/Guest 2 placeholder pair can also be adjacent for display without creating
a profile association. A grouped two-service summary lists Guest 1 before Guest 2.
Unmatched or ambiguous records keep their stable order. Sorting moves entire cards
without changing contact details, practitioner assignments, intake review or messages.

Same-client placeholders are never treated as the separately created profile,
hidden or removed. Multiple possible partners, missing identifiers, mixed roles,
extra grouped services, or inconsistent staff assignments require staff review
instead of an automatic association. Existing observed staff on a grouped card
are preserved with a review note when a separate Guest 2 assignment conflicts.
These associations exist only in the imported cards; the app does not link,
merge, create or modify Boulevard client profiles or appointments.

For a grouped couples visit with both guest roles under the same booking client,
and no separate Guest 2 profile evident in the imported day, the booking client's
draft requests Guest #2's name and cell number immediately before the thank-you.
The same rule covers split Guest 1 and Guest 2 records carrying the same client ID;
only the Guest 1 card receives the request. This paragraph replaces the shorter
individual intake reminder because it already covers both guests' intake forms.
Linked couples cards do not receive the contact request. Missing identifiers or
an unlinked but potentially related Guest 2 profile leave the profile status Needs
verification instead of assuming it is absent. The Guest #2 profile selector lets
staff verify Missing or Has separate profile before copying. No client profiles
are searched beyond the imported appointments, and no intake links or texts are sent.

An appointment containing massage and facial services is described as a
Massage & Facial Experience, with observed practitioners ordered by service start
time. Clearly labeled add-ons or enhancements in service names or categories do
not count as standalone components for this classification. A facial with
microdermabrasion or another add-on is classified as Facial, uses "your facial
session" in the message, and does not require Practitioner 2. All service names
remain visible in the appointment summary. A group flag, multiple practitioners,
or extra service lines alone do not establish a couples or combined visit.
Combined Experience requires explicit body-treatment and facial evidence, or a
manual selection. Separately booked sequential services are not automatically
merged; cross-appointment experience association needs an explicit relationship
rule before implementation.

The existing server-side integration remains on its legacy API configuration.
These edits add only documented read fields to its existing appointment query;
they do not change authentication, install an app, grant scopes or migrate to
2026-06. Future OAuth integration remains a separate task.

## Local validation

Run `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, then
`npm run test:built`. Unit fixtures use invented appointments only. The build
fetches the existing Google Fonts but does not call Boulevard. Built UI checks
inspect the production prerender without signing in or fetching client records.

## Security and Boulevard setup

The deployed app is protected by a staff password. Boulevard appointment data
is retrieved only by a server-side route and is never cached.

The environment template remains in the original checkout; environment files
were intentionally excluded from this review copy. Authorized connected development
requires a private `.env.local` with the following values. Production configuration
and deployment require separate approval:

- `OPS_ACCESS_PASSWORD`: a long, unique staff password
- `OPS_SESSION_SECRET`: a separate random value used to sign eight-hour sessions
- `BLVD_BUSINESS_ID`
- `BLVD_ADMIN_API_KEY`
- `BLVD_ADMIN_SECRET_KEY`
- `BLVD_API_VERSION` (currently `2020-01`)
- `BLVD_LOCATION_ID` only when the business has more than one location

Never prefix Boulevard credentials with `NEXT_PUBLIC_`, commit `.env.local`, or
place credentials in browser code.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the staff
password.

Use **Import Boulevard Day** to select a date and replace the manual cards with
the active appointments scheduled for that day. Every imported field remains
editable before its message is copied.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
