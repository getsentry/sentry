import { describe, expect, test } from "vitest";
import { narrowError, SentryApiError } from "@sentry/api";
import {
  ApiError,
  ApiNotFoundError,
  ApiPermissionError,
  ApiRateLimitError,
  ApiValidationError,
  createApiError,
} from "../../src/api-client/errors.ts";

describe("ApiError", () => {
  test("extends SentryApiError with the status and parsed body", () => {
    const body = { detail: "Project not found" };
    const error = createApiError("Project not found", 404, "Project not found", body);

    expect(error).toBeInstanceOf(ApiNotFoundError);
    expect(error).toBeInstanceOf(SentryApiError);
    expect(error).toMatchObject({
      name: "ApiNotFoundError",
      message: "Project not found",
      status: 404,
      body,
      responseBody: body,
      detail: "Project not found",
      documented: false,
      response: undefined,
    });
  });

  test("keeps client-side validation errors without a status", () => {
    const error = new ApiValidationError("limit must be positive");

    expect(error).toBeInstanceOf(SentryApiError);
    expect(error.status).toBeUndefined();
    expect(error.body).toBeUndefined();
  });

  test("keeps the rate-limit wait", () => {
    const error = createApiError("slow down", 429, undefined, undefined, 2500);

    expect(error).toBeInstanceOf(ApiRateLimitError);
    expect((error as ApiRateLimitError).retryAfterMs).toBe(2500);
  });

  test("keeps the scopes an insufficient_scope 403 accepts and says retrying won't help", () => {
    const detail = "You do not have permission to perform this action.";
    const error = createApiError(detail, 403, detail, { detail }, undefined, [
      "event:write",
      "seer:write",
    ]);

    expect(error).toBeInstanceOf(ApiPermissionError);
    const permissionError = error as ApiPermissionError;
    expect(permissionError.acceptedScopes).toEqual(["event:write", "seer:write"]);
    expect(permissionError.isInsufficientScopeError()).toBe(true);
    expect(permissionError.toUserMessage()).toBe(
      `API error (403): ${detail} The access token is missing the scope this endpoint requires; it needs one of: event:write, seer:write. Retrying with the same token will not help.`,
    );
  });

  test("keeps the plain message for a 403 without accepted scopes", () => {
    const error = createApiError("Forbidden", 403) as ApiPermissionError;

    expect(error.acceptedScopes).toEqual([]);
    expect(error.isInsufficientScopeError()).toBe(false);
    expect(error.toUserMessage()).toBe("API error (403): Forbidden");
  });

  test("ends a scope-less detail with a period before the scope hint", () => {
    const error = new ApiPermissionError("Forbidden", undefined, undefined, [
      "org:read",
    ]);

    expect(error.toUserMessage()).toBe(
      "API error (403): Forbidden. The access token is missing the scope this endpoint requires; it needs one of: org:read. Retrying with the same token will not help.",
    );
  });

  test("is rethrown unchanged by status narrowing, like other subclasses", () => {
    const error = new ApiError("boom", 500);
    const request = new Request("https://sentry.example.test/api/0/");

    expect(() => narrowError({ error, request, response: undefined }, [])).toThrow(error);
  });
});
