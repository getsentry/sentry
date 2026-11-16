/**
 * Generate `ApiRoutes`, a type-only map from each canonical path and HTTP
 * method to its operation's generated types, so callers that build requests
 * from a path, such as the Sentry frontend, can infer inputs and responses
 * without importing an operation function.
 */

import { readFileSync } from "node:fs";
import ts from "typescript";
import { parse, srcPath, writeSource } from "../lib/generated-source.mjs";
import { parseSdkOperations } from "../lib/sdk-operations.mjs";

const { factory } = ts;

/** A property named `name`, quoted only when it isn't an identifier. */
const property = (name, type) =>
  factory.createPropertySignature(
    undefined,
    /^[A-Za-z_$][\w$]*$/.test(name) ? factory.createIdentifier(name) : factory.createStringLiteral(name),
    undefined,
    type,
  );

export function emit() {
  const operations = parseSdkOperations(readFileSync(srcPath("sdk.gen.ts"), "utf8"));
  const declared = new Set(
    parse("types.gen.ts").source.statements
      .filter((statement) => ts.isTypeAliasDeclaration(statement))
      .map((statement) => statement.name.text),
  );

  const imports = new Set();
  const use = (name) => {
    if (!declared.has(name)) return undefined;
    imports.add(name);
    return factory.createTypeReferenceNode(name);
  };

  /** Each path's methods, in SDK order. */
  const routes = new Map();
  for (const { functionName, dataType, method, path } of operations) {
    const typeBase = dataType.replace(/Data$/, "");
    const data = use(dataType);
    const responses = use(`${typeBase}Responses`);
    if (!data || !responses) {
      throw new Error(`generate-api-routes: ${functionName} has no ${data ? "Responses" : "Data"} type`);
    }
    const entry = factory.createTypeLiteralNode([
      property("operation", factory.createLiteralTypeNode(factory.createStringLiteral(functionName))),
      property("data", data),
      property("responses", responses),
      // Operations that document no error responses get an empty map.
      property("errors", use(`${typeBase}Errors`) ?? factory.createTypeLiteralNode([])),
    ]);
    if (!routes.has(path)) routes.set(path, []);
    routes.get(path).push(property(method, entry));
  }

  const routeMap = ts.addSyntheticLeadingComment(
    factory.createInterfaceDeclaration(
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      "ApiRoutes",
      undefined,
      undefined,
      [...routes].map(([path, methods]) => property(path, factory.createTypeLiteralNode(methods))),
    ),
    ts.SyntaxKind.MultiLineCommentTrivia,
    [
      "*",
      " * Every operation by canonical path (relative to `API_BASE_PATH`) and HTTP",
      " * method: its function name, request `data`, and status-keyed `responses`",
      " * and `errors`. Type-only, so importing it adds no runtime code.",
      " ",
    ].join("\n"),
    true,
  );

  writeSource("api-routes.gen.ts", [
    factory.createImportDeclaration(
      undefined,
      factory.createImportClause(
        true,
        undefined,
        factory.createNamedImports(
          [...imports].sort().map((name) =>
            factory.createImportSpecifier(false, undefined, factory.createIdentifier(name))),
        ),
      ),
      factory.createStringLiteral("./types.gen.ts"),
    ),
    routeMap,
  ]);
  console.log(`generate-api-routes: ${operations.length} operations on ${routes.size} paths`);
}
