/**
 * Replace the generated client's query serializer, and the options that
 * configured it, with `serializeQuery` (lib/query-serializer.ts), so every
 * client and operation sorts keys and writes `null` as a bare key by default.
 */
import { writeFileSync } from "node:fs";
import ts from "typescript";
import { edit, parse } from "../lib/generated-source.mjs";

/** The one node under `root` that `match` accepts, or throw. */
function only(file, root, match, what) {
  const found = [];
  (function visit(node) {
    if (match(node)) found.push(node);
    ts.forEachChild(node, visit);
  })(root);
  if (found.length !== 1) throw new Error(`Expected one ${what} in ${file.path}, got ${found.length}`);
  return found[0];
}

const importFrom = module => node => ts.isImportDeclaration(node) && node.moduleSpecifier.text === module;
const declares = name => node => ts.isVariableStatement(node)
  && node.declarationList.declarations.some(declaration => declaration.name.getText() === name);
const named = (kind, name) => node => kind(node) && node.name?.getText() === name;

/** Delete `node` with its leading comments and blank lines. */
const remove = node => ({ start: node.getFullStart(), end: node.end, text: "" });
const replace = (file, node, text) => ({ start: node.getStart(file.source), end: node.end, text });

function rewrite(name, edits) {
  const file = parse(name);
  writeFileSync(file.path, edit(file.text, edits(file)));
}

export function emit() {
  rewrite("client/utils.gen.ts", file => {
    const at = (match, what) => only(file, file.source, match, what);
    const isIdentifier = text => node => ts.isIdentifier(node) && node.text === text;
    const createQuerySerializer = at(declares("createQuerySerializer"), "createQuerySerializer");
    const defaultQuerySerializer = at(declares("defaultQuerySerializer"), "defaultQuerySerializer");
    const buildUrlSerializer = at(node => named(ts.isPropertyAssignment, "querySerializer")(node)
      && ts.isConditionalExpression(node.initializer), "conditional querySerializer");
    const outside = node => node.end <= defaultQuerySerializer.pos || node.pos >= defaultQuerySerializer.end;
    const defaultUse = at(node => isIdentifier("defaultQuerySerializer")(node) && outside(node), "use of defaultQuerySerializer");
    return [
      replace(file, at(importFrom("../core/pathSerializer.gen"), "pathSerializer import"),
        "import { serializeQuery } from '../query-serializer';"),
      remove(at(node => importFrom("../core/bodySerializer.gen")(node) && node.importClause?.isTypeOnly,
        "QuerySerializerOptions import")),
      remove(createQuerySerializer),
      remove(defaultQuerySerializer),
      replace(file, buildUrlSerializer.initializer, "options.querySerializer ?? serializeQuery"),
      replace(file, defaultUse, "serializeQuery"),
    ];
  });

  rewrite("core/types.gen.ts", file => {
    const specifiers = only(file, file.source, importFrom("./bodySerializer.gen"), "bodySerializer import")
      .importClause.namedBindings.elements;
    const index = specifiers.findIndex(specifier => specifier.name.text === "QuerySerializerOptions");
    if (index < 1) throw new Error("Expected QuerySerializerOptions after another bodySerializer import");
    const property = only(file, file.source, named(ts.isPropertySignature, "querySerializer"), "querySerializer option");
    return [
      { start: specifiers[index - 1].end, end: specifiers[index].end, text: "" },
      {
        start: property.getStart(file.source, true),
        end: property.end,
        text: [
          "/**",
          "   * A function that returns the query string for request query parameters,",
          "   * without the `?`. The default sorts keys, writes `null` as a bare key,",
          "   * omits `undefined`, repeats arrays and writes objects in `deepObject` style.",
          "   */",
          "  querySerializer?: QuerySerializer;",
        ].join("\n"),
      },
    ];
  });

  rewrite("core/bodySerializer.gen.ts", file => [
    remove(only(file, file.source, importFrom("./pathSerializer.gen"), "pathSerializer import")),
    remove(only(file, file.source, named(ts.isTypeAliasDeclaration, "QuerySerializerOptionsObject"), "QuerySerializerOptionsObject")),
    remove(only(file, file.source, named(ts.isTypeAliasDeclaration, "QuerySerializerOptions"), "QuerySerializerOptions")),
  ]);

  rewrite("client/index.ts", file => [
    remove(only(file, file.source, node => ts.isExportDeclaration(node)
      && node.exportClause?.elements?.some(element => element.name.text === "QuerySerializerOptions"), "QuerySerializerOptions export")),
  ]);
}
