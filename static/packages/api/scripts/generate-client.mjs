/**
 * Bind generated operations and pagination helpers to one transport without
 * duplicating request logic. Preserve their arguments and documentation.
 */
import { writeFileSync } from "node:fs";
import ts from "typescript";
import { parse, srcPath } from "../lib/generated-source.mjs";

const paginationKinds = ["fetchPage", "paginateAll", "paginateUpTo"];
const reservedNames = new Set(["client", ...paginationKinds]);

export function emit() {
  const methods = [];
  const paginationMethods = Object.fromEntries(paginationKinds.map(kind => [kind, []]));
  // Name the client type so declaration emit references it instead of
  // inlining every bound method, which exceeds tsc's serialization limit.
  const members = [];
  const paginationMembers = Object.fromEntries(paginationKinds.map(kind => [kind, []]));

  for (const module of ["sdk", "pagination"]) {
    const { source } = parse(`${module}.gen.ts`);
    for (const statement of source.statements) {
      if (
        !ts.isVariableStatement(statement) ||
        !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
      ) continue;

      for (const declaration of statement.declarationList.declarations) {
        const fn = declaration.initializer;
        const tupleOptions = fn && ts.isArrowFunction(fn) && module === "sdk" &&
          fn.parameters.length === 1 && fn.parameters[0].dotDotDotToken &&
          ts.isArrayBindingPattern(fn.parameters[0].name) &&
          fn.parameters[0].name.elements.length === 1 &&
          fn.parameters[0].name.elements[0].name?.getText(source) === "options";
        if (
          !ts.isIdentifier(declaration.name) ||
          !fn || !ts.isArrowFunction(fn) ||
          fn.parameters.length === 0 ||
          (!tupleOptions && fn.parameters.some(parameter =>
            !ts.isIdentifier(parameter.name) || parameter.dotDotDotToken || parameter.initializer)
          )
        ) {
          throw new Error(`Unsupported ${module} function: ${declaration.name.getText(source)}`);
        }

        const name = declaration.name.text;
        let methodName = name;
        let destination = methods;
        let memberDestination = members;
        let indent = "    ";
        if (module === "pagination") {
          const kind = paginationKinds.find(kind => name.startsWith(`${kind}_`));
          if (!kind) throw new Error(`Unsupported pagination helper: ${name}`);
          methodName = name.slice(kind.length + 1);
          destination = paginationMethods[kind];
          memberDestination = paginationMembers[kind];
          indent += "  ";
        } else if (reservedNames.has(name)) {
          throw new Error(`SDK operation conflicts with the ${name} property`);
        }

        const generics = fn.typeParameters?.length
          ? `<${fn.typeParameters.map((parameter) => parameter.getText(source)).join(", ")}>`
          : "";
        const typeArguments = fn.typeParameters?.length
          ? `<${fn.typeParameters.map((parameter) => parameter.name.text).join(", ")}>`
          : "";
        const operation = `${module}.${name}${typeArguments}`;
        const optional = fn.parameters[0].questionToken ? "?" : "";
        for (const doc of statement.jsDoc ?? []) {
          const lines = doc.getText(source).split("\n").map((line) => `${indent}${line}`);
          destination.push(...lines);
          memberDestination.push(...lines);
        }
        const returns = `ReturnType<typeof ${operation}>`;
        if (module === "sdk") {
          if (fn.parameters.length !== 1) throw new Error(`Unsupported SDK arguments: ${name}`);
          let argsType = `BoundOperationArgs<Parameters<typeof ${operation}>>`;
          if (tupleOptions) {
            const parameterType = fn.parameters[0].type;
            const tupleType = parameterType && ts.isIntersectionTypeNode(parameterType) && parameterType.types[0];
            const member = tupleType && ts.isTupleTypeNode(tupleType) && tupleType.elements[0];
            const optionsType = member && ts.isNamedTupleMember(member) && member.type;
            if (!optionsType || !ts.isTypeReferenceNode(optionsType) ||
                optionsType.typeName.getText(source) !== "Options" || optionsType.typeArguments?.length !== 2 ||
                !ts.isTypeReferenceNode(optionsType.typeArguments[0]) ||
                !ts.isIdentifier(optionsType.typeArguments[0].typeName) ||
                optionsType.typeArguments[1].getText(source) !== "ThrowOnError") {
              throw new Error(`Unsupported optional SDK arguments: ${name}`);
            }
            // Refer to Options directly: mapping Parameters of a conditional tuple
            // prevents generic consumer wrappers from forwarding their options.
            const boundOptions = `Omit<sdk.Options<types.${optionsType.typeArguments[0].getText(source)}, ThrowOnError>, 'client'>`;
            argsType = `[options?: ${boundOptions}] & ([ThrowOnError] extends [true] ? [options: ${boundOptions}] : unknown)`;
          }
          const parameters = [`${indent}  ...args: ${argsType}`];
          destination.push(
            `${indent}${methodName}: ${generics}(`,
            ...parameters,
            `${indent}) => ${operation}(...([{ ...args[0], client }] as Parameters<typeof ${operation}>)),`,
          );
          memberDestination.push(`${indent}readonly ${methodName}: ${generics}(`, ...parameters, `${indent}) => ${returns};`);
          continue;
        }
        const remainingParameters = fn.parameters.slice(1);
        const parameters = [
          `${indent}  options${optional}: Omit<NonNullable<Parameters<typeof ${operation}>[0]>, 'client'>,`,
          ...remainingParameters.map((parameter, index) =>
            `${indent}  ${parameter.name.text}${parameter.questionToken ? "?" : ""}: Parameters<typeof ${operation}>[${index + 1}],`),
        ];
        destination.push(
          `${indent}${methodName}: ${generics}(`,
          ...parameters,
          `${indent}) => ${operation}({ ...options, client }${remainingParameters.map(parameter => `, ${parameter.name.text}`).join("")}),`,
        );
        memberDestination.push(`${indent}readonly ${methodName}: ${generics}(`, ...parameters, `${indent}) => ${returns};`);
      }
    }
  }

  if (methods.length === 0) throw new Error("No SDK operations found");
  for (const kind of paginationKinds) {
    if (paginationMethods[kind].length === 0) throw new Error(`No ${kind} helpers found`);
  }

  writeFileSync(srcPath("sentry-client.gen.ts"), [
    "// This file is auto-generated by scripts/generate-client.mjs",
    "// Do not edit directly. Re-run `pnpm build` to regenerate.",
    "",
    "import { createClient, type Config, type PreparedClient } from './client';",
    "import * as sdk from './sdk.gen';",
    "import * as pagination from './pagination.gen';",
    "import type * as types from './types.gen';",
    "",
    "// Preserve conditional argument requirements while binding the transport.",
    "type BoundOperationArgs<Args extends readonly unknown[]> = {",
    "  [Key in keyof Args]: Key extends '0' ? Omit<NonNullable<Args[Key]>, 'client'> : Args[Key];",
    "};",
    "",
    "/** An isolated Sentry client with bound, typed API operations; see createSentryClient. */",
    "export interface SentryClient {",
    "  readonly client: PreparedClient;",
    // Members were indented for the object literal; drop one level.
    ...members.map(line => line.slice(2)),
    ...paginationKinds.flatMap(kind => [
      `  readonly ${kind}: {`,
      ...paginationMembers[kind].map(line => line.slice(2)),
      "  };",
    ]),
    "}",
    "",
    "/**",
    " * Create an isolated Sentry client with bound, typed API operations.",
    " * Use `client` for transport configuration, interceptors, and standalone helpers.",
    " * Each method keeps the standalone operation's result and request options.",
    " */",
    "export function createSentryClient(config: Config = {}): SentryClient {",
    "  const client = createClient(config);",
    "  return {",
    "    client,",
    ...methods,
    ...paginationKinds.flatMap(kind => [
      `    ${kind}: {`,
      ...paginationMethods[kind],
      "    },",
    ]),
    "  };",
    "}",
    "",
  ].join("\n"));
}
