// Runs inside a clean project that installed the packed package and one
// optional validator peer, named by the first argument.
import assert from "node:assert/strict";

const peer = process.argv[2];

if (peer === "zod") {
  const { zListOrganizationsResponse } = await import("@sentry/api/zod");
  assert.equal(zListOrganizationsResponse.safeParse([]).success, true);
  assert.equal(zListOrganizationsResponse.safeParse("acme").success, false);
} else if (peer === "valibot") {
  const v = await import("valibot");
  const { vListOrganizationsResponse } = await import("@sentry/api/valibot");
  assert.equal(v.safeParse(vListOrganizationsResponse, []).success, true);
  assert.equal(v.safeParse(vListOrganizationsResponse, "acme").success, false);
} else {
  throw new Error(`Unknown validator peer: ${peer}`);
}
