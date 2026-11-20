/**
 * Export the codes the backend's `SentryAPIException` subclasses send, the
 * string keys each one's `extra` can carry, and which codes are auth
 * challenges, from the spec's `SentryApiErrorBody` component, plus the other
 * codes operations document in their error responses.
 * lib/sentry-errors.ts and lib/auth-challenges.ts derive their types from it.
 */
import ts from "typescript";
import { writeSource } from "../lib/generated-source.mjs";

const { factory } = ts;

const COMPONENT = "SentryApiErrorBody";

/**
 * The string `code` enum values of every documented non-2xx response body,
 * such as the Seer 402 `seer_out_of_credits`, which some endpoints send at the
 * top level instead of in a `SentryAPIException` `detail`.
 */
function operationErrorCodes(spec) {
  const codes = new Set();
  const visit = (schema) => {
    if (typeof schema !== "object" || schema === null) return;
    for (const value of schema.properties?.code?.enum ?? []) {
      if (typeof value === "string") codes.add(value);
    }
    for (const key of ["oneOf", "anyOf", "allOf"]) {
      for (const member of schema[key] ?? []) visit(member);
    }
  };
  for (const pathItem of Object.values(spec.paths ?? {})) {
    for (const operation of Object.values(pathItem)) {
      for (const [status, response] of Object.entries(operation?.responses ?? {})) {
        if (status.startsWith("2")) continue;
        for (const media of Object.values(response?.content ?? {})) visit(media.schema);
      }
    }
  }
  return codes;
}

export function emit({ sourceSpec }) {
  const variants = sourceSpec.components?.schemas?.[COMPONENT]?.properties?.detail?.oneOf;
  if (!Array.isArray(variants) || variants.length === 0) {
    throw new Error(`The spec has no ${COMPONENT} component with detail variants`);
  }

  const challengeCodes = [];
  const entries = variants.map((variant) => {
    const [code, ...others] = variant.properties?.code?.enum ?? [];
    if (typeof code !== "string" || others.length > 0) {
      throw new Error(`${COMPONENT} has a detail variant without exactly one code`);
    }
    const challenge = variant["x-sentry-auth-challenge"];
    if (typeof challenge !== "boolean") {
      throw new Error(`${COMPONENT}: the ${code} variant has no boolean x-sentry-auth-challenge`);
    }
    if (challenge) challengeCodes.push(code);
    const keys = Object.entries(variant.properties?.extra?.properties ?? {}).map(([key, schema]) => {
      if (schema.type !== "string") {
        throw new Error(`${COMPONENT}: the ${code} extra key ${key} is not a string`);
      }
      return key;
    });
    return factory.createPropertyAssignment(
      factory.createStringLiteral(code),
      factory.createArrayLiteralExpression(keys.map((key) => factory.createStringLiteral(key))),
    );
  });

  const exportConst = (name, value) =>
    factory.createVariableStatement(
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            name,
            undefined,
            undefined,
            factory.createAsExpression(value, factory.createTypeReferenceNode("const")),
          ),
        ],
        ts.NodeFlags.Const,
      ),
    );

  const componentCodes = new Set(variants.map((variant) => variant.properties.code.enum[0]));
  const operationCodes = [...operationErrorCodes(sourceSpec)].filter((code) => !componentCodes.has(code)).sort();

  writeSource("error-codes.gen.ts", [
    ts.addSyntheticLeadingComment(
      exportConst("SENTRY_ERROR_EXTRA_KEYS", factory.createObjectLiteralExpression(entries, true)),
      ts.SyntaxKind.MultiLineCommentTrivia,
      [
        "*",
        " * Each code a `SentryAPIException` subclass sends, with the string keys its",
        ` * \`extra\` can carry, from the spec's \`${COMPONENT}\` component.`,
        " ",
      ].join("\n"),
      true,
    ),
    ts.addSyntheticLeadingComment(
      exportConst(
        "SENTRY_AUTH_CHALLENGE_CODES",
        factory.createArrayLiteralExpression(challengeCodes.map((code) => factory.createStringLiteral(code))),
      ),
      ts.SyntaxKind.MultiLineCommentTrivia,
      "* The codes the spec marks with `x-sentry-auth-challenge`. ",
      true,
    ),
    ts.addSyntheticLeadingComment(
      factory.createTypeAliasDeclaration(
        [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        "SentryOperationErrorCode",
        undefined,
        operationCodes.length > 0
          ? factory.createUnionTypeNode(
            operationCodes.map((code) => factory.createLiteralTypeNode(factory.createStringLiteral(code))),
          )
          : factory.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword),
      ),
      ts.SyntaxKind.MultiLineCommentTrivia,
      `* Other \`code\` values that operations document in their error responses, outside \`${COMPONENT}\`. `,
      true,
    ),
  ]);
  console.log(
    `generate-error-codes: ${entries.length} codes, ${challengeCodes.length} auth challenges, ${operationCodes.length} operation codes`,
  );
}
