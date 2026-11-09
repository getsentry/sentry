import type { StandardSchemaV1 } from "../../src/api-client/standard-schema.ts";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiResponseValidationError, validateResponse } from "../../src/api-client/validate.ts";

describe("validateResponse", () => {
  it("returns the output of a Zod schema", () => {
    const schema = z.object({ id: z.coerce.number() });
    const result: { id: number } = validateResponse(schema, { id: "7" });
    expect(result).toEqual({ id: 7 });
  });

  it("returns the output of a valibot schema", () => {
    const schema = v.object({ slug: v.string() });
    expect(validateResponse(schema, { slug: "web", extra: 1 })).toEqual({
      slug: "web",
    });
  });

  it("throws with the issues and their paths", () => {
    const schema = z.object({ project: z.object({ id: z.string() }) });
    let caught: unknown;
    try {
      validateResponse(schema, { project: { id: 1 } });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ApiResponseValidationError);
    const error = caught as ApiResponseValidationError;
    expect(error.issues).toHaveLength(1);
    expect(error.message).toMatch(/^Unexpected API response: project\.id: /);
  });

  it("lists at most three issues in the message", () => {
    const schema = v.object({
      a: v.string(),
      b: v.string(),
      c: v.string(),
      d: v.string(),
    });
    expect(() => validateResponse(schema, {})).toThrow(/\(and 1 more\)$/);
  });

  it("rejects a schema that validates asynchronously", () => {
    const schema: StandardSchemaV1<unknown, unknown> = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: async (value) => ({ value }),
      },
    };
    expect(() => validateResponse(schema, {})).toThrow(TypeError);
  });
});
