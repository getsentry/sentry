import { describe, expect, test } from "vitest";
import { buildClientParams } from "../src/core/params.gen";

describe("generated parameter security (GHSA-hhx9-57xq-r5rw)", () => {
  for (const slot of ["body", "headers", "path", "query"] as const) {
    test(`does not inherit injected properties in ${slot} parameters`, () => {
      const injected = { isAdmin: true };
      const params = buildClientParams(
        [{ legitimate: "value", [`$${slot}___proto__`]: injected }],
        [{ args: [{ in: slot, key: "legitimate" }] }],
      );
      const values = params[slot] as Record<string, unknown>;

      expect(values.legitimate).toBe("value");
      expect(values.isAdmin).toBeUndefined();
      expect(Object.getPrototypeOf(values)).not.toBe(injected);
      const enumerated = [];
      for (const key in values) enumerated.push(key);
      expect(enumerated).not.toContain("isAdmin");
    });
  }
});
