import "server-only";

type BoulevardGraphQLResponse<TData> = {
  data?: TData;
  errors?: Array<{ message: string }>;
};

type AppointmentNode = {
  id: string;
  startAt: string;
  endAt: string;
  cancelled: boolean;
  isGroupedAppointment: boolean;
  client: {
    firstName: string | null;
    lastName: string | null;
    mobilePhone: string | null;
    appointmentCount: number;
  };
  appointmentServices: Array<{
    id: string;
    startAt: string;
    staff: {
      displayName: string;
      firstName: string;
      name: string;
    };
    service: {
      name: string;
      category: { name: string } | null;
    };
  }>;
  appointmentServiceResources: Array<{
    resource: { name: string };
  }>;
};

type LocationsResponse = {
  locations: {
    edges: Array<{
      node: { id: string; name: string; tz: string };
    }>;
  };
};

type AppointmentsResponse = {
  appointments: {
    edges: Array<{ node: AppointmentNode }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

export type ImportedBoulevardAppointment = {
  appointmentId: string;
  clientName: string;
  mobilePhone: string;
  clientType: "New Client" | "Returning Client";
  appointmentType: "Standard" | "Couples Massage";
  greetingTime: "Morning" | "Afternoon";
  practitioner: string;
  secondPractitioner: string;
  suite: string;
  time: string;
  serviceSummary: string;
};

export type DailyAppointmentImport = {
  date: string;
  locationName: string;
  timeZone: string;
  appointments: ImportedBoulevardAppointment[];
};

const LOCATIONS_QUERY = `
  query EnSpaLocations {
    locations(first: 20) {
      edges { node { id name tz } }
    }
  }
`;

const APPOINTMENTS_QUERY = `
  query EnSpaDailyAppointments(
    $locationId: ID!
    $query: QueryString!
    $after: String
  ) {
    appointments(
      locationId: $locationId
      first: 100
      after: $after
      query: $query
    ) {
      edges {
        node {
          id
          startAt
          endAt
          cancelled
          isGroupedAppointment
          client {
            firstName
            lastName
            mobilePhone
            appointmentCount
          }
          appointmentServices {
            id
            startAt
            staff { displayName firstName name }
            service { name category { name } }
          }
          appointmentServiceResources {
            resource { name }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

function readConfiguration() {
  const required = {
    businessId: process.env.BLVD_BUSINESS_ID?.trim(),
    apiKey: process.env.BLVD_ADMIN_API_KEY?.trim(),
    secretKey: process.env.BLVD_ADMIN_SECRET_KEY?.trim(),
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    throw new Error("Boulevard access is not configured for this deployment.");
  }

  return {
    businessId: required.businessId!,
    apiKey: required.apiKey!,
    secretKey: required.secretKey!,
    apiVersion: process.env.BLVD_API_VERSION?.trim() || "2020-01",
    locationId: process.env.BLVD_LOCATION_ID?.trim() || undefined,
  };
}

function decodeBase64(value: string) {
  try {
    const decoded = atob(value);
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch {
    throw new Error("Boulevard access is not configured correctly.");
  }
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function createAdminAuthorization(
  businessId: string,
  apiKey: string,
  secretKey: string,
) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `blvd-admin-v1${businessId}${timestamp}`;
  const key = await crypto.subtle.importKey(
    "raw",
    decodeBase64(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  const token = `${encodeBase64(new Uint8Array(signature))}${payload}`;
  return `Basic ${encodeBase64(new TextEncoder().encode(`${apiKey}:${token}`))}`;
}

async function boulevardGraphQL<
  TData,
  TVariables extends Record<string, unknown>,
>(query: string, variables: TVariables): Promise<TData> {
  const config = readConfiguration();
  const authorization = await createAdminAuthorization(
    config.businessId,
    config.apiKey,
    config.secretKey,
  );
  const endpoint = `https://dashboard.boulevard.io/api/${config.apiVersion}/admin`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const result = (await response.json()) as BoulevardGraphQLResponse<TData>;

  if (!response.ok || result.errors?.length || !result.data) {
    throw new Error(
      result.errors?.[0]?.message || "Boulevard could not return appointments.",
    );
  }

  return result.data;
}

function assertDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Choose a valid calendar date.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new Error("Choose a valid calendar date.");
  }

  return { year, month, day };
}

function timeZoneOffset(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const representedAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  );
  return representedAsUtc - date.getTime();
}

function zonedMidnightUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
) {
  const estimate = new Date(Date.UTC(year, month - 1, day));
  let result = new Date(estimate.getTime() - timeZoneOffset(estimate, timeZone));
  result = new Date(estimate.getTime() - timeZoneOffset(result, timeZone));
  return result;
}

function getDateRange(date: string, timeZone: string) {
  const { year, month, day } = assertDate(date);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    start: zonedMidnightUtc(year, month, day, timeZone).toISOString(),
    end: zonedMidnightUtc(
      nextDay.getUTCFullYear(),
      nextDay.getUTCMonth() + 1,
      nextDay.getUTCDate(),
      timeZone,
    ).toISOString(),
  };
}

function practitionerName(
  staff: AppointmentNode["appointmentServices"][number]["staff"],
) {
  return staff.displayName || staff.firstName || staff.name || "";
}

function inferSuite(node: AppointmentNode, couples: boolean) {
  const resourceNames = node.appointmentServiceResources.map(
    ({ resource }) => resource.name,
  );
  if (resourceNames.some((name) => /suite\s*#?\s*4/i.test(name))) {
    return "Suite #4";
  }
  if (resourceNames.some((name) => /suite\s*#?\s*1/i.test(name))) {
    return "Suite #1";
  }
  return couples ? "Suite #4" : "Suite #1";
}

function normalizeAppointment(
  node: AppointmentNode,
  timeZone: string,
): ImportedBoulevardAppointment {
  const services = node.appointmentServices.map(({ service }) => service.name);
  const practitioners = Array.from(
    new Set(
      node.appointmentServices
        .map(({ staff }) => practitionerName(staff))
        .filter(Boolean),
    ),
  );
  const couples =
    node.isGroupedAppointment ||
    services.some((name) => /couples?/i.test(name)) ||
    practitioners.length > 1;

  return {
    appointmentId: node.id,
    clientName: node.client.firstName || node.client.lastName || "Client",
    mobilePhone: node.client.mobilePhone || "",
    clientType:
      node.client.appointmentCount <= 1 ? "New Client" : "Returning Client",
    appointmentType: couples ? "Couples Massage" : "Standard",
    greetingTime: "Morning",
    practitioner: practitioners[0] || "",
    secondPractitioner: practitioners[1] || "",
    suite: inferSuite(node, couples),
    time: new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(node.startAt)),
    serviceSummary: services.join(" + "),
  };
}

export async function getDailyBoulevardAppointments(
  date: string,
): Promise<DailyAppointmentImport> {
  assertDate(date);
  const config = readConfiguration();
  const locationResponse = await boulevardGraphQL<
    LocationsResponse,
    Record<string, never>
  >(LOCATIONS_QUERY, {});
  const locations = locationResponse.locations.edges.map(({ node }) => node);
  const location = config.locationId
    ? locations.find(({ id }) => id === config.locationId)
    : locations.length === 1
      ? locations[0]
      : undefined;

  if (!location) {
    throw new Error(
      locations.length > 1
        ? "More than one Boulevard location is available. Configure BLVD_LOCATION_ID."
        : "The configured Boulevard location could not be found.",
    );
  }

  const { start, end } = getDateRange(date, location.tz);
  const appointmentQuery =
    `cancelled = false AND startAt >= '${start}' AND startAt < '${end}'`;
  const nodes: AppointmentNode[] = [];
  let after: string | null = null;

  do {
    const response: AppointmentsResponse = await boulevardGraphQL<
      AppointmentsResponse,
      { locationId: string; query: string; after: string | null }
    >(APPOINTMENTS_QUERY, {
      locationId: location.id,
      query: appointmentQuery,
      after,
    });
    nodes.push(...response.appointments.edges.map(({ node }) => node));
    after = response.appointments.pageInfo.hasNextPage
      ? response.appointments.pageInfo.endCursor
      : null;
  } while (after);

  return {
    date,
    locationName: location.name,
    timeZone: location.tz,
    appointments: nodes
      .sort((left, right) => left.startAt.localeCompare(right.startAt))
      .map((node) => normalizeAppointment(node, location.tz)),
  };
}
