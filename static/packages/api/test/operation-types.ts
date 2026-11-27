/** Public discovery types are readonly, including nested parameter metadata. */
import { operations, type ApiOperation, type ApiProjectScope, type ApiQueryParameter } from "@sentry/api/operations";

const operation: ApiOperation | undefined = operations[0];
const parameter: ApiQueryParameter | undefined = operation?.queryParameters[0];
const value: string | number | boolean | null | undefined = parameter?.enum?.[0];

// @ts-expect-error Consumers must not modify the shared catalog.
operations.push(operation!);
if (operation) {
  // @ts-expect-error Operation identities are immutable.
  operation.functionName = "changed";
  // @ts-expect-error Nested discovery metadata is readonly too.
  operation.queryParameters.push({ name: "added", required: false });
}
// @ts-expect-error Enum values must not be changed by consumers.
parameter?.enum?.push("added");
const scope: ApiProjectScope | undefined = operation?.projectScope;
// @ts-expect-error Only Sentry's declared project scopes are values.
const unknownScope: ApiProjectScope = "project";
void value;
void scope;
void unknownScope;
