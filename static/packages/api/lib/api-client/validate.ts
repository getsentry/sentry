/**
 * Response validation through the Standard Schema interface, so the shared
 * client works with any validator that implements it. The MCP passes Zod
 * schemas and the CLI valibot ones; this module depends on neither.
 */

import type { StandardSchemaV1 } from "./standard-schema.js";

/** A schema the host supplies to check a response body. */
export type ResponseSchema<Output = unknown> = StandardSchemaV1<
  unknown,
  Output
>;

const MAX_LISTED_ISSUES = 3;

function issuePath(issue: StandardSchemaV1.Issue): string {
  return (issue.path ?? [])
    .map((segment) =>
      String(typeof segment === "object" ? segment.key : segment),
    )
    .join(".");
}

/** A response did not match the schema the caller validated it with. */
export class ApiResponseValidationError extends Error {
  readonly issues: readonly StandardSchemaV1.Issue[];

  constructor(issues: readonly StandardSchemaV1.Issue[]) {
    const listed = issues.slice(0, MAX_LISTED_ISSUES).map((issue) => {
      const path = issuePath(issue);
      return path ? `${path}: ${issue.message}` : issue.message;
    });
    const more =
      issues.length > MAX_LISTED_ISSUES
        ? ` (and ${issues.length - MAX_LISTED_ISSUES} more)`
        : "";
    super(`Unexpected API response: ${listed.join("; ")}${more}`);
    this.name = "ApiResponseValidationError";
    this.issues = issues;
  }
}

/**
 * Validate `data` with `schema` and return the schema's output.
 *
 * Responses are validated synchronously, as every caller does today, so a
 * schema with async refinements is rejected rather than awaited.
 *
 * @throws {ApiResponseValidationError} When `data` does not match
 */
export function validateResponse<Schema extends StandardSchemaV1>(
  schema: Schema,
  data: unknown,
): StandardSchemaV1.InferOutput<Schema> {
  const result = schema["~standard"].validate(data);
  if (result instanceof Promise) {
    throw new TypeError("Response schemas must validate synchronously");
  }
  if (result.issues) {
    throw new ApiResponseValidationError(result.issues);
  }
  return result.value;
}
