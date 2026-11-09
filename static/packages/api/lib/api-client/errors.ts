import { SentryApiError } from "@sentry/api";

/**
 * Error thrown when user input validation fails.
 * These errors should be returned to the user directly without logging to Sentry.
 */
export class UserInputError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "UserInputError";
  }
}

/**
 * Error thrown when configuration is invalid or missing.
 * These errors should be returned to the user directly without logging to Sentry.
 * Typically used for environment configuration issues, connection settings, etc.
 */
export class ConfigurationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ConfigurationError";
  }
}

/**
 * API Error Class Hierarchy
 *
 * This module defines a hierarchical error system for the Sentry API client
 * that automatically categorizes errors based on HTTP status codes.
 *
 * Key principles:
 * - Every class extends `SentryApiError`, the error the generated operations
 *   return, so `instanceof SentryApiError` matches API failures from both the
 *   operations and the request core
 * - 4xx errors (ApiClientError) are user input errors, not reported to Sentry
 * - 5xx errors (ApiServerError) are system errors, reported to Sentry
 * - Specific error types provide additional context and helper methods
 * - The hierarchy enables type-safe error handling without manual status checks
 */

/**
 * Base class for the request core's API errors.
 * Contains common properties for all API error types.
 * Status is optional since some errors (like client-side validation) don't have HTTP status codes.
 * `body` is the parsed response body, the same value as `responseBody`;
 * `response` is not kept, since the core has consumed it.
 */
export class ApiError extends SentryApiError<number | undefined, unknown, false> {
  constructor(
    message: string,
    status?: number,
    public readonly detail?: string,
    public readonly responseBody?: unknown,
  ) {
    super(status, responseBody, undefined, false, message);
    this.name = "ApiError";
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Client errors (4xx) - User input errors that should NOT be reported to Sentry.
 * These typically indicate issues with the request that the user can fix.
 * Also includes client-side validation errors that don't have HTTP status codes.
 */
export class ApiClientError extends ApiError {
  constructor(
    message: string,
    status?: number,
    detail?: string,
    responseBody?: unknown,
  ) {
    super(message, status, detail, responseBody);
    this.name = "ApiClientError";
    Object.setPrototypeOf(this, ApiClientError.prototype);
  }

  /**
   * Convert to a user-friendly formatted message.
   * Returns the standard format: "API error (status): message" or just "API error: message" if no status.
   * For 404 errors, adds helpful context about checking parameters.
   */
  toUserMessage(): string {
    const baseMessage = this.status
      ? `API error (${this.status}): ${this.message}`
      : `API error: ${this.message}`;

    // Add helpful context for 404 errors, especially generic ones
    if (this.status === 404) {
      // Check if the message is generic
      const genericMessages = [
        "not found",
        "the requested resource does not exist",
        "resource does not exist",
        "resource not found",
      ];

      const isGeneric = genericMessages.some(
        (msg) =>
          this.message.toLowerCase() === msg ||
          this.message.toLowerCase().includes("requested resource"),
      );

      if (isGeneric) {
        return `${baseMessage}. Please verify that the organization, project, or resource ID is correct and that you have access to it.`;
      }
      // For specific messages like "Project not found", just add a hint
      return `${baseMessage}. Please verify the parameters are correct.`;
    }

    return baseMessage;
  }

  /**
   * Check if this is a permission/authorization error (403)
   */
  isPermissionError(): boolean {
    return this.status === 403;
  }

  /**
   * Check if this is a not found error (404)
   */
  isNotFoundError(): boolean {
    return this.status === 404;
  }

  /**
   * Check if this is a validation error (400 or 422)
   */
  isValidationError(): boolean {
    return this.status === 400 || this.status === 422;
  }

  /**
   * Check if this is an authentication error (401)
   */
  isAuthenticationError(): boolean {
    return this.status === 401;
  }

  /**
   * Check if this is a rate limit error (429)
   */
  isRateLimitError(): boolean {
    return this.status === 429;
  }
}

/**
 * Permission denied error (403).
 * Includes special handling for multi-project access errors.
 */
export class ApiPermissionError extends ApiClientError {
  constructor(message: string, detail?: string, responseBody?: unknown) {
    super(message, 403, detail, responseBody);
    this.name = "ApiPermissionError";
    Object.setPrototypeOf(this, ApiPermissionError.prototype);
  }

  /**
   * Check if this is the specific multi-project access error
   */
  isMultiProjectAccessError(): boolean {
    return (
      this.message.includes("multiple projects") ||
      this.message.includes("multi project") ||
      this.message.includes("multi-project") ||
      this.message.includes(
        "You do not have access to query across multiple projects",
      )
    );
  }
}

/**
 * Resource not found error (404).
 * Can include additional context about what resource was not found.
 */
export class ApiNotFoundError extends ApiClientError {
  constructor(
    message: string,
    detail?: string,
    responseBody?: unknown,
    public readonly resourceType?: string,
    public readonly resourceId?: string,
  ) {
    super(message, 404, detail, responseBody);
    this.name = "ApiNotFoundError";
    Object.setPrototypeOf(this, ApiNotFoundError.prototype);
  }
}

/**
 * Validation error (400 or 422 for API responses, or no status for client-side validation).
 * Indicates the request was malformed or contained invalid data.
 */
export class ApiValidationError extends ApiClientError {
  constructor(
    message: string,
    status?: 400 | 422,
    detail?: string,
    responseBody?: unknown,
    public readonly validationErrors?: Record<string, string[]>,
  ) {
    super(message, status, detail, responseBody);
    this.name = "ApiValidationError";
    Object.setPrototypeOf(this, ApiValidationError.prototype);
  }
}

/**
 * Authentication error (401).
 * Indicates the request lacks valid authentication credentials.
 */
export class ApiAuthenticationError extends ApiClientError {
  constructor(message: string, detail?: string, responseBody?: unknown) {
    super(message, 401, detail, responseBody);
    this.name = "ApiAuthenticationError";
    Object.setPrototypeOf(this, ApiAuthenticationError.prototype);
  }
}

/**
 * Rate limit error (429).
 * `retryAfterMs` comes from the response's `Retry-After` or
 * `X-Sentry-Rate-Limit-Reset` header, when it has one.
 */
export class ApiRateLimitError extends ApiClientError {
  constructor(
    message: string,
    detail?: string,
    responseBody?: unknown,
    public readonly retryAfterMs?: number,
  ) {
    super(message, 429, detail, responseBody);
    this.name = "ApiRateLimitError";
    Object.setPrototypeOf(this, ApiRateLimitError.prototype);
  }

  override toUserMessage(): string {
    if (this.retryAfterMs === undefined) {
      return `${super.toUserMessage()}. Retry in a few seconds.`;
    }
    const seconds = Math.max(1, Math.ceil(this.retryAfterMs / 1000));
    return `${super.toUserMessage()}. Retry in ${seconds} second${seconds === 1 ? "" : "s"}.`;
  }
}

/**
 * Server errors (5xx) - System errors that SHOULD be reported to Sentry.
 * These indicate problems with the server that are not the user's fault.
 */
export class ApiServerError extends ApiError {
  constructor(
    message: string,
    status: number,
    detail?: string,
    responseBody?: unknown,
  ) {
    super(message, status, detail, responseBody);
    this.name = "ApiServerError";
    Object.setPrototypeOf(this, ApiServerError.prototype);
  }

  /**
   * Check if this is a gateway/proxy error (502, 503, 504)
   */
  isGatewayError(): boolean {
    return this.status === 502 || this.status === 503 || this.status === 504;
  }

  /**
   * Check if this is an internal server error (500)
   */
  isInternalError(): boolean {
    return this.status === 500;
  }
}

/**
 * Factory function to create the appropriate error type based on HTTP status code.
 * This centralizes the logic for determining which error class to instantiate.
 * This is only used for actual API responses, so status is required.
 */
export function createApiError(
  message: string,
  status: number,
  detail?: string,
  responseBody?: unknown,
  retryAfterMs?: number,
): ApiError {
  // Apply message improvements for known error patterns
  let improvedMessage = message;

  // Handle the multi-project access error that comes in various forms
  if (
    message.includes(
      "You do not have the multi project stream feature enabled",
    ) ||
    message.includes("You cannot view events from multiple projects")
  ) {
    improvedMessage =
      "You do not have access to query across multiple projects. Please select a project for your query.";
    return new ApiPermissionError(improvedMessage, detail, responseBody);
  }

  // Create specific error types based on status code
  switch (status) {
    case 401:
      return new ApiAuthenticationError(message, detail, responseBody);

    case 403:
      return new ApiPermissionError(message, detail, responseBody);

    case 404:
      // TODO: Could extract resource type/ID from the request context
      return new ApiNotFoundError(message, detail, responseBody);

    case 400:
    case 422: {
      // Try to extract validation errors if present
      let validationErrors: Record<string, string[]> | undefined;
      if (
        responseBody &&
        typeof responseBody === "object" &&
        "errors" in responseBody
      ) {
        validationErrors = responseBody.errors as Record<string, string[]>;
      }
      return new ApiValidationError(
        message,
        status as 400 | 422,
        detail,
        responseBody,
        validationErrors,
      );
    }

    case 429:
      return new ApiRateLimitError(message, detail, responseBody, retryAfterMs);

    default:
      // Generic categorization for other status codes
      if (status >= 400 && status < 500) {
        return new ApiClientError(message, status, detail, responseBody);
      }
      if (status >= 500 && status < 600) {
        return new ApiServerError(message, status, detail, responseBody);
      }
      // Fallback for unusual status codes
      return new ApiError(message, status, detail, responseBody);
  }
}

/**
 * Returns true if `error` is an `ApiAuthenticationError`, either directly or
 * anywhere within the first few levels of `error.cause`. Tools that wrap
 * upstream errors as `throw new Error(msg, { cause: apiError })` would
 * otherwise hide the 401 signal from a direct `instanceof` check. Bounded
 * depth guards against accidental cycles.
 */
export function isApiAuthenticationErrorDeep(error: unknown): boolean {
  let current: unknown = error;
  for (let i = 0; i < 3; i++) {
    if (current instanceof ApiAuthenticationError) return true;
    if (!(current instanceof Error)) return false;
    current = current.cause;
  }
  return false;
}
