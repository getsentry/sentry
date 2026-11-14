import { readFileSync } from "node:fs";
import * as v from "valibot";
import { describe, expect, test } from "vitest";
import { vCreateOrganizationDashboardData, vDeployResponse, vUpdateOrganizationDetectorResponse } from "../src/valibot";
import { zCreateOrganizationDashboardData, zDeployResponse, zUpdateOrganizationDetectorResponse } from "../src/zod";

const spec = JSON.parse(readFileSync(new URL("../spec/openapi-derefed.json", import.meta.url), "utf8"));

describe("validator descriptions", () => {
  test("Valibot fields carry their OpenAPI description as a description action", () => {
    expect(v.getDescription(vDeployResponse.entries.id)).toEqual(expect.any(String));
  });

  test("nullable fields keep their description inside the nullable wrapper", () => {
    expect(v.getDescription(vDeployResponse.entries.name.wrapped)).toEqual(expect.any(String));
    expect(zDeployResponse.shape.name.unwrap().description).toEqual(expect.any(String));
  });

  test("union fields carry the description of the union itself", () => {
    expect(v.getDescription(vUpdateOrganizationDetectorResponse.entries.config)).toEqual(expect.any(String));
    expect(zUpdateOrganizationDetectorResponse.shape.config.description).toEqual(expect.any(String));
  });

  test("fields that wrap one schema in allOf keep their own description", () => {
    const description = spec.paths["/organizations/{organization_id_or_slug}/dashboards/"]
      .post.requestBody.content["application/json"].schema.properties.permissions.description;
    expect(description).toEqual(expect.any(String));
    expect(v.getDescription(vCreateOrganizationDashboardData.entries.body.entries.permissions.wrapped)).toBe(description);
    expect(zCreateOrganizationDashboardData.shape.body.shape.permissions.unwrap().unwrap().description).toBe(description);
  });

  test("Valibot top-level schemas stay unpiped for object methods", () => {
    expect("pipe" in vDeployResponse).toBe(false);
    expect(v.partial(vDeployResponse).entries.id.type).toBe("optional");
  });

  test("Zod fields carry their OpenAPI description", () => {
    expect(zDeployResponse.shape.id.description).toEqual(expect.any(String));
  });
});
