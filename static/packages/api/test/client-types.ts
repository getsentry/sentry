/** Public-package type checks for the bound operation facade; never executed. */
import {
  createSentryClient,
  listOrganizations,
  paginateAll_listOrganizations,
  type Config,
  type ListOrganizationsData,
  type Options,
  type SentryClient,
} from "@sentry/api";
import type * as operations from "../src/sdk.gen";

type OperationNames = keyof typeof operations;
type BoundOperationNames = Exclude<keyof SentryClient, "client" | "fetchPage" | "paginateAll" | "paginateUpTo">;
// Both directions catch missing operations and accidental additional exports.
const completeSurface: [OperationNames] extends [BoundOperationNames] ? true : false = true;
const exactSurface: [BoundOperationNames] extends [OperationNames] ? true : false = true;
void [completeSurface, exactSurface];

function publicFactory() {
  const config: Config = { baseUrl: "https://example.test" };
  const configured: SentryClient = createSentryClient(config);
  const defaults: SentryClient = createSentryClient();
  configured.client.setConfig(config);
  configured.client.interceptors.request.use(request => request);
  // @ts-expect-error Replacing the raw transport would not rebind closed-over methods.
  configured.client = defaults.client;
  // @ts-expect-error Bound operation properties are readonly.
  configured.listOrganizations = defaults.listOrganizations;
  void defaults;
  return configured;
}

async function preparedRequests(sentry: SentryClient) {
  const request: Request = await sentry.client.prepareRequest({
    method: "GET", url: "/api/0/custom/", query: { cursor: "opaque" },
  });
  // @ts-expect-error Generic preparation requires an explicit method.
  await sentry.client.prepareRequest({ url: "/api/0/custom/" });
  // Custom clients accepted by standalone operations need no new capability.
  const { prepareRequest, ...legacyClient } = sentry.client;
  await listOrganizations({ client: legacyClient });
  void [request, prepareRequest];
}

async function streamingCallbacks(sentry: SentryClient) {
  const { stream } = await sentry.client.sse.get<string>({
    url: "/api/0/events/",
    onSseEvent: event => {
      const value: string = event.data.toUpperCase();
      // @ts-expect-error SSE callback data retains the requested type.
      const wrong: number = event.data;
      void [value, wrong];
    },
  });
  const next = await stream.next();
  if (!next.done) {
    const value: string = next.value;
    void value;
  }
}

async function operationArguments(sentry: SentryClient) {
  await sentry.listOrganizations();
  await sentry.listOrganizations({ query: { owner: true }, signal: new AbortController().signal });
  await sentry.getOrganization({ path: { organization_id_or_slug: "example" } });
  await sentry.createOrganizationDashboard({
    path: { organization_id_or_slug: "example" },
    body: { title: "Overview" },
  });

  // @ts-expect-error Required operation options must not become optional.
  await sentry.getOrganization();
  // @ts-expect-error Required path parameters must remain required.
  await sentry.getOrganization({});
  // @ts-expect-error A required mutation body must remain required.
  await sentry.createOrganizationDashboard({ path: { organization_id_or_slug: "example" } });
  // @ts-expect-error The generated body shape must not become any.
  await sentry.createOrganizationDashboard({ path: { organization_id_or_slug: "example" }, body: { title: 1 } });
  // @ts-expect-error Query parameters retain their declared types.
  await sentry.listOrganizations({ query: { owner: "yes" } });
  // @ts-expect-error The bound context cannot be replaced through operation options.
  await sentry.listOrganizations({ client: sentry.client });

  // Client-side query defaults keep the generated parameter types, so the
  // empty-list opt-out needs no cast and unknown values are still rejected.
  const event = { path: { organization_id_or_slug: "example", issue_id: "1", event_id: "latest" as const } };
  await sentry.getOrganizationIssueEvent(event);
  await sentry.getOrganizationIssueEvent({ ...event, query: { collapse: [] } });
  // @ts-expect-error Query defaults do not widen the documented enum.
  await sentry.getOrganizationIssueEvent({ ...event, query: { collapse: ["everything"] } });
  const projectEvent = {
    path: { organization_id_or_slug: "example", project_id_or_slug: "example", event_id: "a".repeat(32) },
  };
  await sentry.getProjectEvent(projectEvent);
  await sentry.getProjectEvent({ ...projectEvent, query: { collapse: [] } });
  // @ts-expect-error Query defaults do not widen the documented enum.
  await sentry.getProjectEvent({ ...projectEvent, query: { collapse: ["everything"] } });
}

async function responseAndThrowingTypes(sentry: SentryClient, throwOnError: boolean) {
  const path = { organization_id_or_slug: "example" };
  const returning = await sentry.getOrganization({ path });
  // @ts-expect-error The default non-throwing result still has an error branch.
  returning.data.slug;
  if (returning.data) {
    const slug: string = returning.data.slug;
    void slug;
  }

  const throwing = await sentry.getOrganization({ path, throwOnError: true });
  const slug: string = throwing.data.slug;
  // @ts-expect-error Successful response fields retain their concrete type.
  const wrongSlug: number = throwing.data.slug;
  // @ts-expect-error The throwOnError:true result has no error field.
  throwing.error;

  const explicit = await sentry.getOrganization<true>({ path, throwOnError: true });
  const explicitSlug: string = explicit.data.slug;
  const conditional = await sentry.getOrganization({ path, throwOnError });
  // @ts-expect-error A boolean flag must preserve the possible error branch.
  conditional.data.slug;

  const { listOrganizations: detached } = sentry;
  const organizations = await detached({ throwOnError: true });
  const firstSlug: string | undefined = organizations.data[0]?.slug;
  const response: Response = organizations.response;
  void [slug, wrongSlug, explicitSlug, firstSlug, response];
}

async function standaloneInteroperability(sentry: SentryClient) {
  const named = await listOrganizations({ client: sentry.client, throwOnError: true });
  const paginated = await paginateAll_listOrganizations({ client: sentry.client });
  const first: string | undefined = named.data[0]?.slug;
  const second: string | undefined = paginated.data[0]?.slug;
  void [first, second];
}

async function explicitThrowRequiresRuntimeOption(sentry: SentryClient, throwOnError: boolean) {
  const path = { organization_id_or_slug: "example" };
  const bound = await sentry.listOrganizations<true>({ throwOnError: true });
  const standalone = await listOrganizations<true>({ client: sentry.client, throwOnError: true });
  const slug: string | undefined = bound.data[0]?.slug;
  const standaloneSlug: string | undefined = standalone.data[0]?.slug;

  // @ts-expect-error A type argument cannot turn on throwing at runtime.
  await sentry.listOrganizations<true>();
  // @ts-expect-error Explicit true also requires the corresponding runtime flag.
  await sentry.listOrganizations<true>({});
  // @ts-expect-error A false flag cannot support a success-only result.
  await sentry.listOrganizations<true>({ throwOnError: false });
  // @ts-expect-error Required endpoint options still need the runtime flag.
  await sentry.getOrganization<true>({ path });
  // @ts-expect-error Standalone operations have the same guarantee as bound ones.
  await listOrganizations<true>();
  // @ts-expect-error Supplying a configured client does not prove it throws.
  await listOrganizations<true>({ client: sentry.client });

  const conditionalBound = await sentry.listOrganizations({ throwOnError });
  const conditionalStandalone = await listOrganizations({ client: sentry.client, throwOnError });
  // @ts-expect-error A boolean flag preserves the possible failure branch.
  conditionalBound.data[0];
  // @ts-expect-error The same is true for standalone operations.
  conditionalStandalone.data[0];
  void [slug, standaloneSlug];
}

async function rawTransportThrowTypes(sentry: SentryClient) {
  const url = "/api/0/organizations/";
  // @ts-expect-error Raw methods cannot promise success from only a type argument.
  await sentry.client.get<string, unknown, true>({ url });
  // @ts-expect-error Raw requests need the runtime guarantee as well.
  await sentry.client.request<string, unknown, true>({ url, method: "GET" });
  const method = await sentry.client.get<string, unknown, true>({ url, throwOnError: true });
  const request = await sentry.client.request<string, unknown, true>({ url, method: "GET", throwOnError: true });
  const methodData: string = method.data;
  const requestData: string = request.data;
  void [methodData, requestData];
}

function forwardOptionalOperation<ThrowOnError extends boolean>(
  sentry: SentryClient,
  options: Omit<Options<ListOrganizationsData, ThrowOnError>, "client">,
) {
  return sentry.listOrganizations<ThrowOnError>(options);
}

function forwardOptionalArguments<ThrowOnError extends boolean>(
  sentry: SentryClient,
  ...args: Parameters<typeof listOrganizations<ThrowOnError>>
) {
  return sentry.listOrganizations<ThrowOnError>(...args);
}

async function genericForwardingTypes(sentry: SentryClient, throwOnError: boolean) {
  const throwing = await forwardOptionalOperation<true>(sentry, { throwOnError: true });
  const slug: string | undefined = throwing.data[0]?.slug;
  const conditional = await forwardOptionalArguments<boolean>(sentry, { throwOnError });
  // @ts-expect-error Forwarding a boolean flag retains the possible failure branch.
  conditional.data[0];
  void slug;
}

async function mutableClientConfiguration() {
  const sentry = createSentryClient({ throwOnError: true });
  sentry.client.setConfig({ throwOnError: false });
  const result = await sentry.listOrganizations();
  // @ts-expect-error Mutable client configuration cannot promise success-only results.
  result.data[0];
}

async function fieldsContract(sentry: SentryClient) {
  // @ts-expect-error Data-only responses are not part of the SDK contract.
  createSentryClient({ responseStyle: "data" });
  // @ts-expect-error Mutable configuration has the same restriction.
  sentry.client.setConfig({ responseStyle: "data" });
  // @ts-expect-error Bound operations cannot override the fields contract.
  await sentry.listOrganizations({ responseStyle: "data" });
  // @ts-expect-error Standalone/injected operations use the same contract.
  await listOrganizations({ client: sentry.client, responseStyle: "data" });

  const result = await sentry.listOrganizations();
  // @ts-expect-error A fetch rejection need not have an HTTP response.
  const alwaysResponse: Response = result.response;
  if (!("error" in result)) {
    const response: Response = result.response;
    const slug: string | undefined = result.data[0]?.slug;
    void [response, slug];
  } else {
    const response: Response | undefined = result.response;
    // @ts-expect-error Arbitrary fetch/interceptor errors require narrowing.
    result.error.status;
    void response;
  }
  sentry.client.interceptors.error.use((error, response) => {
    // @ts-expect-error Fetch rejection hooks have no response.
    response.headers.get("retry-after");
    return error;
  });
  void alwaysResponse;
}

void publicFactory;
void operationArguments;
void responseAndThrowingTypes;
void standaloneInteroperability;
void explicitThrowRequiresRuntimeOption;
void rawTransportThrowTypes;
void genericForwardingTypes;
void mutableClientConfiguration;
void fieldsContract;
