/**
 * A success-only return type requires throwOnError: true on the same call.
 * Client configuration is mutable, so an explicit type argument cannot replace
 * that runtime option. Preserve inference for true, false, and boolean callers.
 */
import { writeFileSync } from "node:fs";
import ts from "typescript";
import { edit, parse } from "../lib/generated-source.mjs";

export function emit() {
  const types = parse("client/types.gen.ts");
  const typeEdits = [];
  for (const name of ["Options", "MethodFn", "RequestFn"]) {
    const declarations = types.source.statements.filter(statement =>
      ts.isTypeAliasDeclaration(statement) && statement.name.text === name);
    if (declarations.length !== 1) throw new Error(`Expected one generated ${name} type`);
    const declaration = declarations[0];
    let node = declaration.type;
    if (name !== "Options") {
      if (!ts.isFunctionTypeNode(node) || node.parameters.length !== 1 || !node.parameters[0].type) {
        throw new Error(`Unsupported generated ${name} signature`);
      }
      node = node.parameters[0].type;
    }
    typeEdits.push({
      start: node.getStart(types.source),
      end: node.end,
      text: `(${node.getText(types.source)}) & RequireThrowOnError<ThrowOnError>`,
    });
  }
  const constrainedTypes = edit(types.text, typeEdits) + `
/** Success-only types require a per-call runtime guarantee. */
type RequireThrowOnError<ThrowOnError extends boolean> =
  [ThrowOnError] extends [true] ? { throwOnError: true } : unknown;
`;

  const sdk = parse("sdk.gen.ts");
  const sdkEdits = [];
  let optionalOperations = 0;
  for (const statement of sdk.source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const fn = declaration.initializer;
      if (!fn || !ts.isArrowFunction(fn)) continue;
      if (fn.parameters.length !== 1 || !ts.isIdentifier(fn.parameters[0].name) ||
          fn.parameters[0].name.text !== "options" ||
          !fn.typeParameters?.some(parameter => parameter.name.text === "ThrowOnError")) {
        throw new Error(`Unsupported generated operation: ${declaration.name.getText(sdk.source)}`);
      }
      const parameter = fn.parameters[0];
      if (!parameter.questionToken) continue;
      if (!parameter.type) throw new Error("Generated options must have a type");
      const optionsType = parameter.type.getText(sdk.source);
      sdkEdits.push({
        start: parameter.getStart(sdk.source),
        end: parameter.end,
        text: `...[options]: [options?: ${optionsType}] & ([ThrowOnError] extends [true] ? [options: ${optionsType}] : unknown)`,
      });
      // The conditional tuple guarantees options when required. Assert that fact
      // while forwarding; spreading undefined still works for ordinary calls.
      let spreads = 0;
      function visit(node) {
        if (ts.isSpreadAssignment(node) && ts.isIdentifier(node.expression) && node.expression.text === "options") {
          sdkEdits.push({ start: node.expression.end, end: node.expression.end, text: "!" });
          spreads++;
        }
        ts.forEachChild(node, visit);
      }
      visit(fn.body);
      if (spreads !== 1) throw new Error(`Expected one options spread in ${declaration.name.getText(sdk.source)}`);
      optionalOperations++;
    }
  }
  if (!optionalOperations) throw new Error("No optional generated operations found");

  writeFileSync(types.path, constrainedTypes);
  writeFileSync(sdk.path, edit(sdk.text, sdkEdits));
}
