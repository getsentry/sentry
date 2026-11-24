/**
 * Repository oxlint rules.
 *
 * `no-typescript-source-strings`: generated TypeScript is built from compiler
 * nodes and printed with `writeSource` (lib/generated-source.mjs). Writing a
 * `.ts` file from a string, template, concatenation or `.join()`, or patching
 * one with `replaceOnce`, builds source text by hand, which nothing checks
 * until tsc runs on the output.
 */

const WRITERS = new Set(["writeFileSync", "appendFileSync"]);

const calleeName = callee =>
  callee.type === "Identifier" ? callee.name
    : callee.type === "MemberExpression" && !callee.computed ? callee.property.name
      : undefined;

/** The initializer of the `const` that `identifier` names, if any. */
function constInit(context, identifier) {
  let scope = context.sourceCode.getScope(identifier);
  for (; scope; scope = scope.upper) {
    const variable = scope.set.get(identifier.name);
    if (!variable) continue;
    const declarator = variable.defs[0]?.node;
    return declarator?.type === "VariableDeclarator" && declarator.parent.kind === "const"
      ? declarator.init ?? undefined
      : undefined;
  }
  return undefined;
}

/**
 * Whether `node` names a `.ts` file: "x.ts", `${dir}/x.ts`, srcPath("x.ts"),
 * or a `const` set to one of those.
 */
function isTypeScriptPath(context, node) {
  switch (node.type) {
    case "Literal":
      return typeof node.value === "string" && node.value.endsWith(".ts");
    case "TemplateLiteral":
      return node.quasis.at(-1).value.cooked.endsWith(".ts");
    case "CallExpression":
      return node.arguments.some(argument => isTypeScriptPath(context, argument));
    case "Identifier": {
      const init = constInit(context, node);
      return init !== undefined && isTypeScriptPath(context, init);
    }
    default:
      return false;
  }
}

/** Whether `node` assembles text by hand rather than printing nodes. */
function isHandBuiltText(node) {
  switch (node.type) {
    case "Literal":
      return typeof node.value === "string";
    case "TemplateLiteral":
      return true;
    case "BinaryExpression":
      return node.operator === "+";
    case "CallExpression":
      return calleeName(node.callee) === "join";
    default:
      return false;
  }
}

const message = "Build generated TypeScript from compiler nodes and print it with writeSource(), not from source strings.";

export default {
  meta: { name: "sentry-api" },
  rules: {
    "no-typescript-source-strings": {
      meta: { type: "problem", docs: { description: message } },
      create(context) {
        return {
          CallExpression(node) {
            const name = calleeName(node.callee);
            const [path, data] = node.arguments;
            if (name === "replaceOnce"
              || (WRITERS.has(name) && path && data && isTypeScriptPath(context, path) && isHandBuiltText(data))) {
              context.report({ node, message });
            }
          },
        };
      },
    },
  },
};
