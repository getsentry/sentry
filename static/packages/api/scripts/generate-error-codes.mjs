/**
 * Export the codes the backend's `SentryAPIException` subclasses send, the
 * string keys each one's `extra` can carry, and which codes are auth
 * challenges, from the spec's `SentryApiErrorBody` component.
 * lib/sentry-errors.ts and lib/auth-challenges.ts derive their types from it.
 */
import ts from "typescript";
import { writeSource } from "../lib/generated-source.mjs";

const { factory } = ts;

const COMPONENT = "SentryApiErrorBody";

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
  ]);
  console.log(`generate-error-codes: ${entries.length} codes, ${challengeCodes.length} auth challenges`);
}
