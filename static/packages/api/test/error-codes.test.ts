import { readFileSync } from "node:fs";
import { describe, expect, expectTypeOf, test, vi } from "vitest";
import {
  type AuthChallengeHandler,
  createSentryClient,
  getSentryAuthChallenge,
  isSentryErrorCode,
  type KnownSentryErrorCode,
  narrowError_getOrganization,
  SentryApiError,
  type SentryAuthChallenge,
  withAuthChallenges,
} from "@sentry/api";
import { createApiClientCore } from "../src/api-client/core.ts";

const sentryBody = (code: string, extra: Record<string, unknown> = {}, message = "Message") => ({
  detail: { code, message, extra },
});

const errorWith = (status: number, body: unknown) => new SentryApiError(status, body, undefined, false);

const path = { organization_id_or_slug: "org-slug" };

describe("Sentry error codes", () => {
  test("exposes code, detailMessage and extra and keeps the error's message", async () => {
    const sentry = createSentryClient({
      baseUrl: "https://sentry.example.com",
      fetch: async () => Response.json(sentryBody("sudo-required", { username: "jane" }, "Account verification required."), { status: 401 }),
    });
    const { error } = await sentry.getOrganization({ path });
    expect(error).toBeInstanceOf(SentryApiError);
    expect(error).toMatchObject({
      message: "Sentry API request failed with status 401",
      status: 401,
      code: "sudo-required",
      detailMessage: "Account verification required.",
      extra: { username: "jane" },
    });
  });

  test.each([
    { detail: "The requested resource does not exist" },
    { detail: { message: "The requested resource does not exist" } },
  ])("exposes response detail without an error code", async (body) => {
    const sentry = createSentryClient({
      baseUrl: "https://sentry.example.com",
      fetch: async () => Response.json(body, { status: 404 }),
    });
    const { error } = await sentry.getOrganization({ path });
    expect(error).toBeInstanceOf(SentryApiError);
    expect(error).toMatchObject({
      message: "Sentry API request failed with status 404",
      detailMessage: "The requested resource does not exist",
      body,
    });
    expect(error).not.toHaveProperty("code");
    expect(error).not.toHaveProperty("extra");
  });

  test("leaves the fields off other bodies", () => {
    for (const body of [{ name: ["This field is required."] }, "Bad gateway", { detail: { code: "", message: 42 } }]) {
      const error = errorWith(400, body);
      expect(error).not.toHaveProperty("code");
      expect(error).not.toHaveProperty("detailMessage");
      expect(error).not.toHaveProperty("extra");
    }
  });

  test("defaults a missing message and extra", () => {
    expect(errorWith(400, { detail: { code: "invalid-request" } })).toMatchObject({ code: "invalid-request", detailMessage: "", extra: {} });
    for (const extra of [null, "orgSlug", ["orgSlug"]]) {
      const error = errorWith(400, { detail: { code: "invalid-request", message: 1, extra } });
      expect(error.detailMessage).toBe("");
      expect(error.extra).toEqual({});
    }
  });

  test("keeps the fields through status narrowing and on /client errors", async () => {
    const sentry = createSentryClient({
      baseUrl: "https://sentry.example.com",
      fetch: async () => Response.json(sentryBody("2fa-required"), { status: 401 }),
    });
    const result = await narrowError_getOrganization({ client: sentry.client, path });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("2fa-required");
    const core = createApiClientCore({
      transport: { request: async () => Response.json(sentryBody("member-disabled-over-limit"), { status: 401 }) },
      headers: () => ({}),
      logger: { warn: () => {} },
    });
    expect(await core.request("https://sentry.example.com", "/organizations/").catch((e: unknown) => e))
      .toMatchObject({ status: 401, code: "member-disabled-over-limit" });
  });

  describe("a top-level code", () => {
    // The Seer 402 body: `code` sits next to `detail` instead of inside it.
    const seerOutOfCredits = {
      detail: "Your organization does not have enough Seer credits.",
      code: "seer_out_of_credits",
      denialReason: "daily_cap_exceeded",
    };

    test("is read when the body has no SentryAPIException detail", () => {
      expect(errorWith(402, seerOutOfCredits)).toMatchObject({
        status: 402,
        code: "seer_out_of_credits",
        detailMessage: "Your organization does not have enough Seer credits.",
        extra: {},
        body: seerOutOfCredits,
      });
      expect(errorWith(409, { code: "repos_not_linked" })).toMatchObject({ code: "repos_not_linked", detailMessage: "", extra: {} });
    });

    test("reaches /client errors", async () => {
      const core = createApiClientCore({
        transport: { request: async () => Response.json(seerOutOfCredits, { status: 402 }) },
        headers: () => ({}),
        logger: { warn: () => {} },
      });
      expect(await core.request("https://sentry.example.com", "/organizations/").catch((e: unknown) => e))
        .toMatchObject({ status: 402, code: "seer_out_of_credits" });
    });

    test("loses to a SentryAPIException detail and ignores non-string codes", () => {
      expect(errorWith(401, { ...sentryBody("sudo-required", { username: "jane" }), code: "other" }))
        .toMatchObject({ code: "sudo-required", extra: { username: "jane" } });
      for (const body of [{ code: ["This field is required."] }, { code: "" }, { detail: "Not found", code: 404 }]) {
        expect(errorWith(400, body)).not.toHaveProperty("code");
      }
    });

    test("includes the codes operations document in KnownSentryErrorCode", () => {
      expectTypeOf<
        "seer_out_of_credits" | "seer_out_of_quota" | "scm_integration_required" | "repos_not_linked" | "run_in_flight"
      >().toExtend<KnownSentryErrorCode>();
      const error: unknown = errorWith(402, seerOutOfCredits);
      expect(isSentryErrorCode(error, "seer_out_of_credits")).toBe(true);
    });
  });

  test("isSentryErrorCode narrows by code", () => {
    const error: unknown = errorWith(401, sentryBody("sso-required", { loginUrl: "/auth/login/org-slug/" }));
    expect(isSentryErrorCode(error, "sudo-required")).toBe(false);
    expect(isSentryErrorCode(new Error("sso-required"), "sso-required")).toBe(false);
    if (!isSentryErrorCode(error, "sso-required")) {
      throw new Error("expected sso-required");
    }
    expectTypeOf(error.code).toEqualTypeOf<"sso-required">();
    expect(error.extra.loginUrl).toBe("/auth/login/org-slug/");
    expect(isSentryErrorCode(errorWith(400, sentryBody("custom-code")), "custom-code")).toBe(true);
  });
});

describe("auth challenges", () => {
  test.each<[number, unknown, SentryAuthChallenge | undefined]>([
    [401, sentryBody("sso-required", { loginUrl: "https://org-slug.sentry.example.com/auth/login/org-slug/", organizationSlug: "org-slug" }),
      { code: "sso-required", status: 401, message: "Message", loginUrl: "https://org-slug.sentry.example.com/auth/login/org-slug/", organizationSlug: "org-slug" }],
    [401, sentryBody("sudo-required", { username: "jane" }), { code: "sudo-required", status: 401, message: "Message", username: "jane" }],
    [401, sentryBody("primary-email-verification-required", { username: "jane" }),
      { code: "primary-email-verification-required", status: 401, message: "Message", username: "jane" }],
    [401, sentryBody("member-disabled-over-limit", { next: "/organizations/org-slug/disabled-member/" }),
      { code: "member-disabled-over-limit", status: 401, message: "Message", next: "/organizations/org-slug/disabled-member/" }],
    [401, sentryBody("2fa-required"), { code: "2fa-required", status: 401, message: "Message" }],
    [403, sentryBody("superuser-required"), { code: "superuser-required", status: 403, message: "Message" }],
    [403, sentryBody("superuser-required", { orgSlug: "org-slug" }), { code: "superuser-required", status: 403, message: "Message", orgSlug: "org-slug" }],
    [403, sentryBody("staff-required"), { code: "staff-required", status: 403, message: "Message" }],
    [401, sentryBody("sso-required", { loginUrl: 1 }), { code: "sso-required", status: 401, message: "Message", loginUrl: undefined, organizationSlug: undefined }],
    [401, sentryBody("data-secrecy"), undefined],
    [400, sentryBody("sudo-required"), undefined],
    [401, { detail: "Invalid token" }, undefined],
  ])("classifies %i %j", (status, body, challenge) => {
    expect(getSentryAuthChallenge(errorWith(status, body))).toEqual(challenge);
  });

  test("ignores other errors", () => {
    expect(getSentryAuthChallenge(new Error("sudo-required"))).toBeUndefined();
    expect(getSentryAuthChallenge(new SentryApiError(undefined, sentryBody("sudo-required"), undefined, false))).toBeUndefined();
  });

  type Variant = {
    properties: { code: { enum: [string] }; extra: { properties: Record<string, unknown> } };
    "x-sentry-status": number;
    "x-sentry-auth-challenge": boolean;
  };
  const variants: Variant[] = JSON.parse(readFileSync(new URL("../spec/openapi-derefed.json", import.meta.url), "utf8"))
    .components.schemas.SentryApiErrorBody.properties.detail.oneOf;
  const specChallengeCodes = variants
    .filter((variant) => variant["x-sentry-auth-challenge"])
    .map((variant) => variant.properties.code.enum[0])
    .sort();

  test("classifies exactly the codes the spec marks, with the extra fields it lists", () => {
    expect(specChallengeCodes).not.toHaveLength(0);
    for (const variant of variants) {
      const code = variant.properties.code.enum[0];
      const extra = Object.fromEntries(Object.keys(variant.properties.extra.properties).map((key) => [key, `${key}-value`]));
      const challenge = getSentryAuthChallenge(errorWith(variant["x-sentry-status"], sentryBody(code, extra)));
      if (variant["x-sentry-auth-challenge"]) {
        expect(challenge).toMatchObject({ code, ...extra });
      } else {
        expect(challenge).toBeUndefined();
      }
    }
  });

  test("the README lists the codes the spec marks", () => {
    const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
    const sentence = readme.match(/Some 401 and 403 responses ask the user to act in Sentry: ([^.]+)\./)?.[1] ?? "";
    expect([...sentence.matchAll(/`([^`]+)`/g)].map((match) => match[1]).sort()).toEqual(specChallengeCodes);
  });
});

describe("withAuthChallenges", () => {
  const sudo = () => Response.json(sentryBody("sudo-required", { username: "jane" }), { status: 401 });

  const setup = (responses: (() => Response)[], onAuthChallenge: AuthChallengeHandler) => {
    const bodies: string[] = [];
    const fetch = vi.fn(async (input: Request | string | URL, init?: RequestInit) => {
      bodies.push(await new Request(input, init).text());
      return responses[fetch.mock.calls.length - 1]!();
    });
    const handler = vi.fn(onAuthChallenge);
    const sentry = createSentryClient({ baseUrl: "https://sentry.example.com", fetch: withAuthChallenges(fetch, { onAuthChallenge: handler }) });
    return { fetch, handler, bodies, sentry };
  };

  test("replays the request once after the handler returns retry", async () => {
    const { fetch, handler, bodies, sentry } = setup([sudo, () => Response.json({ slug: "org-slug" })], () => "retry");
    const { data } = await sentry.updateOrganization({ path, body: { name: "New name" } });
    expect(data).toEqual({ slug: "org-slug" });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(bodies).toEqual(['{"name":"New name"}', '{"name":"New name"}']);
    expect(handler).toHaveBeenCalledOnce();
    const [challenge, request] = handler.mock.calls[0]!;
    expect(challenge).toEqual({ code: "sudo-required", status: 401, message: "Message", username: "jane" });
    expect([request.method, request.url]).toEqual(["PUT", "https://sentry.example.com/api/0/organizations/org-slug/"]);
  });

  test("returns the challenge response after fail, or after a second challenge", async () => {
    const failed = setup([sudo], async () => "fail" as const);
    const { error } = await failed.sentry.getOrganization({ path });
    expect(failed.fetch).toHaveBeenCalledOnce();
    expect(error).toMatchObject({ status: 401, code: "sudo-required", body: sentryBody("sudo-required", { username: "jane" }) });

    const twice = setup([sudo, sudo], () => "retry");
    expect((await twice.sentry.getOrganization({ path })).error).toMatchObject({ code: "sudo-required" });
    expect(twice.fetch).toHaveBeenCalledTimes(2);
    expect(twice.handler).toHaveBeenCalledOnce();
  });

  test("replays even when releasing the challenge body fails", async () => {
    const unreleasable = () => {
      const response = sudo();
      Object.defineProperty(response, "body", { value: { cancel: () => Promise.reject(new Error("cancel failed")) } });
      return response;
    };
    const { fetch, sentry } = setup([unreleasable, () => Response.json({ slug: "org-slug" })], () => "retry");
    expect((await sentry.getOrganization({ path })).data).toEqual({ slug: "org-slug" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("does not call the handler for other responses", async () => {
    const { fetch, handler, sentry } = setup(
      [() => Response.json({ detail: "Invalid token" }, { status: 401 }), () => new Response("<html>", { status: 403 }), () => Response.json({})],
      () => "retry",
    );
    for (let i = 0; i < 3; i++) {
      await sentry.getOrganization({ path });
    }
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(handler).not.toHaveBeenCalled();
  });
});
