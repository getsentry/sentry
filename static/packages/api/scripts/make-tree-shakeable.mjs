/**
 * Keep the generated modules free of eager work at import time so bundlers can
 * drop whatever a consumer does not use.
 *
 * - Validator schemas: every top-level `v.*(…)` / `z.*(…)` call gets a
 *   `/* @__PURE__ *\/` annotation. Nested calls need their own annotation:
 *   bundlers keep the side effects of a removed pure call's arguments. One
 *   annotation covers a whole method chain (`z.number().int().optional()`),
 *   because every call in the chain starts at the same position.
 * - Default client: created on first use, so importing the SDK does not
 *   construct `Headers` (which makes Node load its fetch implementation).
 *
 * Each step fails closed so generator upgrades cannot silently undo it.
 */
import ts from "typescript";
import { replaceOnce, update } from "../lib/generated-source.mjs";

const PURE = "/* @__PURE__ */ ";

function rootIdentifier(expression) {
  while (
    ts.isCallExpression(expression)
    || ts.isPropertyAccessExpression(expression)
    || ts.isElementAccessExpression(expression)
    || ts.isParenthesizedExpression(expression)
  ) {
    expression = expression.expression;
  }
  return ts.isIdentifier(expression) ? expression.text : undefined;
}

function annotateSchemaCalls(namespace) {
  return (source, name) => {
    const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
    const positions = new Set();
    const schemas = new Set(file.statements.flatMap(statement =>
      ts.isVariableStatement(statement)
        ? statement.declarationList.declarations.flatMap(declaration =>
            ts.isIdentifier(declaration.name) ? [declaration.name.text] : [])
        : []));

    const visit = node => {
      // Calls inside callbacks do not run at import time; leave them alone.
      if (ts.isFunctionLike(node)) return;
      if (ts.isNewExpression(node)) {
        throw new Error(`${name}: unexpected top-level \`new\` expression: ${node.getText(file).slice(0, 80)}`);
      }
      if (ts.isCallExpression(node)) {
        const root = rootIdentifier(node.expression);
        // Composite Zod request schemas reference extracted layers with
        // zOperationPath.optional() instead of repeating z.object(...).
        const optionalSchema = root && schemas.has(root)
          && ts.isPropertyAccessExpression(node.expression)
          && node.expression.name.text === "optional";
        if (root !== namespace && !optionalSchema) {
          throw new Error(`${name}: unexpected top-level call outside \`${namespace}.*\`: ${node.getText(file).slice(0, 80)}`);
        }
        positions.add(node.getStart(file));
      }
      ts.forEachChild(node, visit);
    };

    for (const statement of file.statements) {
      if (ts.isImportDeclaration(statement)) continue;
      if (!ts.isVariableStatement(statement)) {
        throw new Error(`${name}: unexpected top-level statement: ${statement.getText(file).slice(0, 80)}`);
      }
      visit(statement);
    }
    if (positions.size === 0) {
      throw new Error(`${name}: found no \`${namespace}.*\` schema calls to annotate`);
    }

    let output = "";
    let last = 0;
    for (const position of [...positions].sort((a, b) => a - b)) {
      output += source.slice(last, position) + PURE;
      last = position;
    }
    return output + source.slice(last);
  };
}

export function emit() {
  update("valibot.gen.ts", annotateSchemaCalls("v"));
  update("zod.gen.ts", annotateSchemaCalls("z"));

  update("client.gen.ts", source => {
    source = replaceOnce(source,
      "import { type Client, type ClientOptions, type Config, createClient, createConfig } from './client';",
      "import { type ClientOptions, type Config, createClient, createConfig, type PreparedClient } from './client';");
    return replaceOnce(source,
      "export const client: Client = createClient(createConfig<ClientOptions2>());",
      `let defaultClient: PreparedClient | undefined;

/**
 * The default client used when an operation is called without \`client\`.
 * It is created on first use so importing the SDK stays free of eager work.
 */
export const client: PreparedClient = ${PURE}new Proxy({} as PreparedClient, {
  get: (_target, key) => Reflect.get((defaultClient ??= createClient(createConfig<ClientOptions2>())), key),
});`);
  });
}
