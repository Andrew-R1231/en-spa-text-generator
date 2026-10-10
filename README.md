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

Rebecca is removed from practitioner choices. An imported appointment containing
that name retains its observed practitioner in the draft and displays a review
notice; the app never silently assigns a replacement practitioner.

The Intake form selector controls the reminder immediately before the thank-you
sentence. A positive `pendingFormCount` defaults to Incomplete, zero defaults to
Complete, and an absent or invalid count stays Unknown. Boulevard defines this
count as all remaining appointment forms, not specifically intake forms. Staff
can override the selection after checking the appointment. No form contents or
answers are requested. See the [Boulevard Appointment reference](https://developers.joinblvd.com/graphql-admin-api/api-reference/types/Appointment).

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

An appointment containing massage and facial services is described as a
Massage & Facial Experience, with observed practitioners ordered by service start
time. A group flag or multiple practitioners alone no longer implies couples
massage. A neutral Combined Experience option supports body-plus-facial visits
and manual corrections. Separately booked sequential services are not automatically
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
