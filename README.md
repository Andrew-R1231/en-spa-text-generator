# EN Spa Operations

Internal EN Spa tools for preparing daily client text messages.

## Security and Boulevard setup

The deployed app is protected by a staff password. Boulevard appointment data
is retrieved only by a server-side route and is never cached.

Copy `.env.example` to `.env.local` for local development. Configure the same
values in Vercel for production:

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
