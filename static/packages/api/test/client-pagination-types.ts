/** Public-package pagination type contracts; never executed. */
import { consumePage, paginateUpTo, type BudgetedPageFetcher, type CollectionPage, type CollectionPageFetcher, type PaginatedCollection, type PaginationContinuation, type SentryClient } from "@sentry/api";
import type * as pagination from "../src/pagination.gen";

type Kind = "fetchPage" | "paginateAll" | "paginateUpTo";
type Bind<Function> = Function extends (options: infer Options, ...args: infer Args) => infer Result
  ? (options: Omit<Options, "client">, ...args: Args) => Result
  : never;
type Expected<Prefix extends Kind> = {
  [Name in keyof typeof pagination as Name extends `${Prefix}_${infer Operation}` ? Operation : never]:
    Bind<typeof pagination[Name]>;
};
type ExactNames<Prefix extends Kind> =
  Exclude<keyof SentryClient[Prefix], keyof Expected<Prefix>> |
  Exclude<keyof Expected<Prefix>, keyof SentryClient[Prefix]>;
const complete: { [Prefix in Kind]: ExactNames<Prefix> extends never ? true : false } = {
  fetchPage: true,
  paginateAll: true,
  paginateUpTo: true,
};
const signatures: {
  [Prefix in Kind]: SentryClient[Prefix] extends Expected<Prefix>
    ? Expected<Prefix> extends SentryClient[Prefix] ? true : false
    : false;
} = { fetchPage: true, paginateAll: true, paginateUpTo: true };
void [complete, signatures];

async function pageTypes(sentry: SentryClient) {
  const options = { path: { organization_id_or_slug: "example" } };
  const page = await sentry.fetchPage.listOrganizationProjects(options, "opaque:0:0");
  const slug: string | undefined = page.data[0]?.slug;
  const response: Response = page.response;
  const header: string | null = response.headers.get("X-Hits");
  const next: string | undefined = page.nextCursor;
  void [slug, header, next];

  // @ts-expect-error A required path remains required.
  await sentry.fetchPage.listOrganizationProjects({});
  // @ts-expect-error Cursor belongs in the helper's separate argument.
  await sentry.fetchPage.listOrganizationProjects({ ...options, query: { cursor: "x" } });
  // @ts-expect-error A bound helper cannot accept another transport.
  await sentry.fetchPage.listOrganizationProjects({ ...options, client: sentry.client });
  // @ts-expect-error Existing query parameters remain typed.
  await sentry.fetchPage.listOrganizations({ query: { owner: "yes" } });
  // @ts-expect-error Cursor remains a string.
  await sentry.fetchPage.listOrganizationProjects(options, 1);
  // @ts-expect-error Bound helper properties are readonly.
  sentry.fetchPage.listOrganizationProjects = sentry.fetchPage.listOrganizationProjects;
}

async function collectionTypes(sentry: SentryClient) {
  const options = { path: { organization_id_or_slug: "example" } };
  const all = await sentry.paginateAll.listOrganizationProjects(options);
  const batch = await sentry.paginateUpTo.listOrganizationProjects(options, {
    limit: 250,
    startCursor: "opaque:0:0",
  });
  const slug: string | undefined = all.data[0]?.slug;
  const batchSlug: string | undefined = batch.data[0]?.slug;
  const reason: "exhausted" | "limit" | "maxPages" = batch.stopReason;
  const typed: PaginatedCollection<{ slug: string }> = all;
  const fromPage = await paginateUpTo(
    cursor => sentry.fetchPage.listOrganizationProjects(options, cursor),
    { limit: 10 }, "projects",
  );
  const pageSlug: string | undefined = fromPage.data[0]?.slug;
  const normalized: CollectionPageFetcher<string> = async () => ({ data: ["one"] });
  // @ts-expect-error Request belongs to the SDK result envelope, not normalized metadata.
  const mixedPage: CollectionPage<string> = { data: ["one"], request: new Request("https://example.test") };
  // @ts-expect-error Normalized fetchers reject; they cannot carry an ignored error.
  const mixedError: CollectionPage<string> = { data: ["one"], error: new Error("failed") };
  const strings = await paginateUpTo(normalized, { limit: 1 }, "custom");
  const value: string | undefined = strings.data[0];
  const sdkFetcher: BudgetedPageFetcher<string[], unknown> = async () => ({
    data: ["one"], request: new Request("https://example.test"), response: new Response(),
  });
  const sdkResponse: Response | undefined = (await sdkFetcher(undefined, 1)).response;
  void [pageSlug, value, sdkResponse];
  void [slug, batchSlug, reason, typed];
  if (batch.continuation) {
    const continuation: PaginationContinuation = batch.continuation;
    await sentry.paginateUpTo.listOrganizationProjects(options, { limit: 10, resume: continuation });
    const consumed = consumePage({ data: batch.data }, { offset: 0 }, 5);
    const consumedSlug: string | undefined = consumed.data[0]?.slug;
    void consumedSlug;
  }
  // @ts-expect-error Partial replay must preserve its original request budget.
  const missingBudget: PaginationContinuation = { cursor: "opaque", offset: 5 };
  // @ts-expect-error Pagination must not mutate a caller's continuation.
  if (batch.continuation) batch.continuation.offset = 1;
  // @ts-expect-error Collections now expose their items through data.
  all.map(item => item.slug);

  // @ts-expect-error Bounded collection requires a budget.
  await sentry.paginateUpTo.listOrganizationProjects(options);
  // @ts-expect-error A budget requires an item limit.
  await sentry.paginateUpTo.listOrganizationProjects(options, {});
  // @ts-expect-error Array-only collection helpers must not appear for compound bodies.
  sentry.paginateAll.listProjectReplayClicks;
  // @ts-expect-error Array-only collection helpers must not appear for compound bodies.
  sentry.paginateUpTo.listProjectReplayClicks;
  // @ts-expect-error A collection does not have a single HTTP response.
  batch.response;
}

void pageTypes;
void collectionTypes;
