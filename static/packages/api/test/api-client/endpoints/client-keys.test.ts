import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  jsonResponse,
  ORIGIN,
  scriptedTarget,
} from "../support.ts";
import {
  createClientKey,
  listClientKeys,
  updateClientKey,
} from "../../../src/api-client/endpoints/client-keys.ts";

const KeyZod = z.object({ id: z.string() });
const project = { organizationSlug: "acme", projectSlug: "web" };
const keysUrl = `${ORIGIN}/api/0/projects/acme/web/keys/`;

describe("listClientKeys", () => {
  it("reads the project's keys", async () => {
    const { apiTarget, request } = scriptedTarget(jsonResponse([{ id: "a" }]));

    const keys = await listClientKeys(apiTarget, project, z.array(KeyZod));

    expect(keys).toEqual([{ id: "a" }]);
    expect(request.mock.calls[0]?.[0]).toBe(keysUrl);
  });
});

describe("createClientKey", () => {
  it("posts the name", async () => {
    const { apiTarget, request } = scriptedTarget(jsonResponse({ id: "a" }));

    await createClientKey(apiTarget, { ...project, name: "Prod" }, KeyZod);

    const [url, init] = request.mock.calls[0] ?? [];
    expect(url).toBe(keysUrl);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ name: "Prod" }));
  });
});

describe("updateClientKey", () => {
  it("puts only the fields that are set, keeping a null rate limit", async () => {
    const { apiTarget, request } = scriptedTarget(jsonResponse({ id: "a" }));

    await updateClientKey(
      apiTarget,
      { ...project, keyId: 7, isActive: false, rateLimit: null },
      KeyZod,
    );

    const [url, init] = request.mock.calls[0] ?? [];
    expect(url).toBe(`${keysUrl}7/`);
    expect(init?.method).toBe("PUT");
    expect(init?.body).toBe(
      JSON.stringify({ isActive: false, rateLimit: null }),
    );
  });
});
