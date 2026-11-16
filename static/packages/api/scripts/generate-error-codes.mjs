/**
 * Export the codes the backend's `SentryAPIException` subclasses send, and the
 * string keys each one's `extra` can carry, from the spec's
 * `SentryApiErrorBody` component. lib/sentry-errors.ts and
 * lib/auth-challenges.ts derive their types from it.
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

  const entries = variants.map((variant) => {
    const [code, ...others] = variant.properties?.code?.enum ?? [];
    if (typeof code !== "string" || others.length > 0) {
      throw new Error(`${COMPONENT} has a detail variant without exactly one code`);
    }
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

  const declaration = factory.createVariableStatement(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          "SENTRY_ERROR_EXTRA_KEYS",
          undefined,
          undefined,
          factory.createAsExpression(
            factory.createObjectLiteralExpression(entries, true),
            factory.createTypeReferenceNode("const"),
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

  writeSource("error-codes.gen.ts", [
    ts.addSyntheticLeadingComment(
      declaration,
      ts.SyntaxKind.MultiLineCommentTrivia,
      [
        "*",
        " * Each code a `SentryAPIException` subclass sends, with the string keys its",
        ` * \`extra\` can carry, from the spec's \`${COMPONENT}\` component.`,
        " ",
      ].join("\n"),
      true,
    ),
  ]);
  console.log(`generate-error-codes: ${entries.length} codes`);
}
