/**
 * Compile-time type checks for the generated wrappers.
 *
 * This file is type-checked but never executed. It asserts that the
 * generated wrappers preserve type information at the consumer boundary —
 * specifically:
 *   1. Path/query/body params remain typed.
 *   2. The cursor parameter is rejected from `query` (managed by the helper).
 *   3. The return type is the correct response shape (Array vs compound).
 *
 * If this file ever fails `tsc --noEmit`, the generator has regressed.
 */

import {
  fetchPage_listOrganizationIssues,
  fetchPage_listOrganizationProjects,
  fetchPage_listProjectReplayClicks,
  narrowError,
  narrowError_getProject,
  paginateAll_listOrganizationIssues,
  paginateAll_listOrganizationProjects,
  paginateUpTo_listOrganizationIssues,
} from "../src/index";
import type {
  ListOrganizationTraceItemAttributesQueryAttributeType,
  ListOrganizationTraceItemAttributesQueryDataset,
} from "../src/index";
import type { InferOutput } from "valibot";
import type { z } from "zod";
import { vAutofixPostResponse } from "../src/valibot";
import { zAutofixPostResponse } from "../src/zod";

const valibotResponse: InferOutput<typeof vAutofixPostResponse> = {
  run_id: 1,
  sentry_run_id: null,
  feature_id: "autofix",
};
const zodResponse: z.infer<typeof zAutofixPostResponse> = valibotResponse;
void zodResponse;

const config = {
  baseUrl: "https://sentry.io",
  headers: { Authorization: "Bearer test" },
};

// =====================================================================
// fetchPage — array-shaped op
// =====================================================================

async function fetchPageHappyPath() {
  const result = await fetchPage_listOrganizationIssues({
    ...config,
    path: { organization_id_or_slug: "my-org" },
    query: {
      // collapse should be allowed (not the cursor we manage)
      collapse: ["stats"],
      limit: 25,
    },
  });
  // Return type is PaginatedResponse<TArrayShape>; data is the array
  // (whose element type is the issue object the SDK declares).
  result.data.length;
  // nextCursor / prevCursor are typed strings | undefined
  if (result.nextCursor) {
    const _: string = result.nextCursor;
  }
}

async function fetchPageRejectsCursor() {
  await fetchPage_listOrganizationIssues({
    ...config,
    path: { organization_id_or_slug: "my-org" },
    query: {
      // @ts-expect-error — `cursor` must NOT be passable here (helper-managed)
      cursor: "abc",
    },
  });
}

async function fetchPageRequiresPath() {
  // @ts-expect-error — required path param must still be required
  await fetchPage_listOrganizationIssues({
    ...config,
    query: { limit: 25 },
  });
}

// =====================================================================
// paginateAll / paginateUpTo — array-shaped op
// =====================================================================

async function paginateAllHappyPath() {
  const items = await paginateAll_listOrganizationIssues({
    ...config,
    path: { organization_id_or_slug: "my-org" },
    query: { limit: 100 },
  });
  items.data.length;
  items.stopReason;
}

async function paginateUpToHappyPath() {
  const result = await paginateUpTo_listOrganizationIssues(
    {
      ...config,
      path: { organization_id_or_slug: "my-org" },
      query: { limit: 100 },
    },
    { limit: 250, onPage: (n, t) => console.log(n, t) },
  );
  result.data.length;
  if (result.nextCursor) {
    const _: string = result.nextCursor;
  }
}

// =====================================================================
// fetchPage — compound-shaped op
// =====================================================================

async function fetchPageCompoundOp() {
  const result = await fetchPage_listProjectReplayClicks({
    ...config,
    path: {
      organization_id_or_slug: "my-org",
      project_id_or_slug: "my-proj",
      replay_id: "00000000-0000-0000-0000-000000000000",
    },
  });
  // Compound 200 shape — `data` is whatever the spec declared (object,
  // not Array). We just assert it's not `unknown` by accessing it.
  void result.data;
}

// =====================================================================
// per_page widening — undocumented but runtime-supported
// =====================================================================

async function perPageAcceptedEvenWhenSpecOmitsIt() {
  // /organizations/{org}/projects/ has only `cursor` declared in the spec,
  // but the runtime accepts `per_page`. PaginationQuery widens with it so
  // callers don't need an `as` cast.
  await paginateAll_listOrganizationProjects({
    ...config,
    path: { organization_id_or_slug: "my-org" },
    query: { per_page: 100 },
  });

  // Same for fetchPage on issues — per_page co-exists with documented
  // params (collapse, limit, sort, etc.).
  await fetchPage_listOrganizationProjects({
    ...config,
    path: { organization_id_or_slug: "my-org" },
    query: { per_page: 100 },
  });
}

// =====================================================================
// Removed unsafe cursor override
// =====================================================================

async function rejectsUnsafeCursorOverride() {
  await paginateUpTo_listOrganizationIssues(
    { ...config, path: { organization_id_or_slug: "my-org" } },
    {
      limit: 250,
      // @ts-expect-error A cursor must not skip discarded rows.
      keepCursorOnOvershoot: true,
    },
  );
}

void fetchPageHappyPath;
void fetchPageRejectsCursor;
void fetchPageRequiresPath;
void paginateAllHappyPath;
void paginateUpToHappyPath;
void fetchPageCompoundOp;
void perPageAcceptedEvenWhenSpecOmitsIt;
void rejectsUnsafeCursorOverride;

// =====================================================================
// narrowError — status-discriminated HTTP error handling
// =====================================================================

async function narrowErrorHappyPath() {
  const res = await narrowError_getProject({
    ...config,
    path: {
      organization_id_or_slug: "my-org",
      project_id_or_slug: "my-proj",
    },
  });
  if (res.ok) {
    // Success branch exposes the typed 200 body.
    void res.data;
    return;
  }
  if (!res.error.documented) {
    // Includes unexpected HTTP statuses. Other exceptions reject unchanged.
    return;
  }
  switch (res.error.status) {
    case 403:
    case 404:
      throw res.error; // user-actionable
  }
}

async function statusNarrowsErrorBody() {
  type Errors = {
    400: { kind: "bad-request" };
    404: { kind: "not-found" };
  };
  const sdkResult = null as unknown as Parameters<
    typeof narrowError<unknown, Errors>
  >[0];
  const result = narrowError<unknown, Errors>(sdkResult, [400, 404]);
  if (result.ok || !result.error.documented) return;

  if (result.error.status === 400) {
    const kind: "bad-request" = result.error.body.kind;
    void kind;
  } else {
    const kind: "not-found" = result.error.body.kind;
    void kind;
  }
}

void narrowErrorHappyPath;
void statusNarrowsErrorBody;

// Enum query parameters are named, and array parameters name their element.
const attributeDataset: ListOrganizationTraceItemAttributesQueryDataset = "tracemetrics";
// @ts-expect-error "errors" is not a trace item dataset.
const invalidAttributeDataset: ListOrganizationTraceItemAttributesQueryDataset = "errors";
const attributeType: ListOrganizationTraceItemAttributesQueryAttributeType = "number";
// @ts-expect-error The alias is the element type, not the array.
const attributeTypeList: ListOrganizationTraceItemAttributesQueryAttributeType = ["number"];
void [attributeDataset, invalidAttributeDataset, attributeType, attributeTypeList];
