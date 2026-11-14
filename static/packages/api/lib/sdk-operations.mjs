/** Read operation identities from generated SDK source before bundling. */
import ts from "typescript";

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);

/** Find Options<OperationData, …>, including optional rest-tuple arguments. */
function findOptions(node, source) {
  if (ts.isTypeReferenceNode(node) && node.typeName.getText(source) === "Options") return node;
  return ts.forEachChild(node, child => findOptions(child, source));
}

/**
 * Extract exported function names, data types, HTTP methods and canonical paths.
 * Fail on unsupported generator output instead of publishing incomplete metadata.
 * @param {string} text Contents of sdk.gen.ts.
 * @returns {{functionName:string, dataType:string, method:string, path:string}[]}
 */
export function parseSdkOperations(text) {
  const source = ts.createSourceFile("sdk.gen.ts", text, ts.ScriptTarget.Latest, true);
  const operations = [];
  const routes = new Set();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) ||
        !statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const fn = declaration.initializer;
      if (!ts.isIdentifier(declaration.name) || !fn || !ts.isArrowFunction(fn)) {
        throw new Error(`Unsupported SDK operation: ${declaration.name.getText(source)}`);
      }
      const options = fn.parameters[0]?.type && findOptions(fn.parameters[0].type, source);
      const dataType = options?.typeArguments?.[0];
      const call = ts.isCallExpression(fn.body) && fn.body;
      const callee = call && call.expression;
      const request = call && call.arguments[0];
      const url = request && ts.isObjectLiteralExpression(request) && request.properties.find(property =>
        ts.isPropertyAssignment(property) &&
        (ts.isStringLiteral(property.name) ? property.name.text : property.name.getText(source)) === "url");
      if (!dataType || !ts.isTypeReferenceNode(dataType) || !ts.isIdentifier(dataType.typeName) ||
          !callee || !ts.isPropertyAccessExpression(callee) || !HTTP_METHODS.has(callee.name.text) ||
          !url || !ts.isStringLiteralLike(url.initializer)) {
        throw new Error(`Unsupported SDK operation: ${declaration.name.text}`);
      }
      const method = callee.name.text.toUpperCase();
      const path = url.initializer.text;
      const key = `${method} ${path}`;
      if (routes.has(key)) throw new Error(`Multiple SDK operations for ${key}`);
      routes.add(key);
      operations.push({ functionName: declaration.name.text, dataType: dataType.typeName.text, method, path });
    }
  }
  if (operations.length === 0) throw new Error("No SDK operations found");
  return operations;
}
