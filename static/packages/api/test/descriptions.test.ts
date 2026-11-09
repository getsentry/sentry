import * as v from "valibot";
import { describe, expect, test } from "vitest";
import { vDeployResponse } from "../src/valibot";
import { zDeployResponse } from "../src/zod";

describe("validator descriptions", () => {
  test("Valibot fields carry their OpenAPI description as a description action", () => {
    expect(v.getDescription(vDeployResponse.entries.id)).toEqual(expect.any(String));
  });

  test("nullable fields keep their description inside the nullable wrapper", () => {
    expect(v.getDescription(vDeployResponse.entries.name.wrapped)).toEqual(expect.any(String));
    expect(zDeployResponse.shape.name.unwrap().description).toEqual(expect.any(String));
  });

  test("Valibot top-level schemas stay unpiped for object methods", () => {
    expect("pipe" in vDeployResponse).toBe(false);
    expect(v.partial(vDeployResponse).entries.id.type).toBe("optional");
  });

  test("Zod fields carry their OpenAPI description", () => {
    expect(zDeployResponse.shape.id.description).toEqual(expect.any(String));
  });
});
