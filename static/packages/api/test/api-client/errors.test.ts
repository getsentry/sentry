import { describe, expect, test } from "vitest";
import { narrowError, SentryApiError } from "@sentry/api";
import {
  ApiError,
  ApiNotFoundError,
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

  test("is rethrown unchanged by status narrowing, like other subclasses", () => {
    const error = new ApiError("boom", 500);
    const request = new Request("https://sentry.example.test/api/0/");

    expect(() => narrowError({ error, request, response: undefined }, [])).toThrow(error);
  });
});
