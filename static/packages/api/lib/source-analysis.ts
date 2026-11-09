/** Build-time analysis of API usage in consumer-supplied TypeScript source. */

import { posix } from "node:path";
import ts from "typescript";
import type { ApiOperation } from "./operation-types.js";

/** Identity supplied by the generated SDK operation catalog. */
export type SourceApiOperation = Pick<ApiOperation, "functionName" | "method" | "path">;

/** A consumer's raw request wrapper, identified by its resolved function name. */
export type SourceApiRequest = {
  functionName: string;
  /** Zero-based argument containing the request path. */
  pathArgument: number;
  /** Zero-based argument containing the options object. */
  optionsArgument: number;
  /** Options property containing query parameters. Defaults to `query`. */
  queryProperty?: string;
  /** Method when the options omit it. Defaults to GET; unknown spreads stay unknown. */
  defaultMethod?: string;
};

/** Consumer conventions; none of these lists are inferred from command names. */
export type SourceApiAnalysisOptions = {
  /** Factory names whose returned objects contain deferred callbacks. */
  boundaries?: readonly string[];
  /** Raw request wrappers to link to the operation catalog. */
  requests?: readonly SourceApiRequest[];
  /** Query keys to retain. The Sentry `query` key also retains fixed joined terms. */
  queryParameters?: readonly string[];
  /** Boolean property names to report when explicitly set to true. */
  declarationFlags?: readonly string[];
};

/** An operation reachable from a source declaration. */
export type SourceOperationUsage = SourceApiOperation & {
  /** Known query values or fixed terms; callers may add further filters. */
  query?: Record<string, string>;
};

/** A raw request whose identity cannot be established from the public catalog. */
export type UnresolvedApiRequest = {
  /** Source module, using the caller's source-map keys. */
  file: string;
  /** One-based request call line. */
  line: number;
  /** Known HTTP method, when statically available. */
  method?: string;
  /** Known path template, when statically available. */
  path?: string;
  /** Why no operation was selected. */
  reason: string;
};

/** Source-derived relationships; no command is executed to obtain them. */
export type SourceApiUsage = {
  /** Discovered API operations, preserving distinct contexts. */
  operations: SourceOperationUsage[];
  /** Reachable raw requests that need explicit discovery diagnostics. */
  unresolvedRequests: UnresolvedApiRequest[];
  /** Known HTTP methods, including unresolved requests and static method properties. */
  methods: string[];
};

/** Source relationships and deferred callback boundaries; never executes input code. */
export type SourceApiAnalysis = {
  /** Source file → exported symbol → reachable API usage. */
  exports: Map<string, Map<string, SourceApiUsage>>;
  /** Exported boundaries and their consumer-selected factory/flag evidence. */
  boundaries: { file: string; name: string; factories: string[]; flags: string[] }[];
};

type Binding = { file: string; name: string };
type Declaration = {
  node: ts.Node;
  refs: Set<string>;
  calls: Set<string>;
  usage: SourceApiUsage;
  boundary: boolean;
  factories: Set<string>;
  flags: Set<string>;
};
type Module = {
  source: ts.SourceFile;
  imports: Map<string, Binding>;
  exports: Map<string, Binding>;
  stars: string[];
  declarations: Map<string, Declaration>;
};

const SDK = "@sentry/api";
const API_PREFIX = /^\/api\/\d+(?=\/)/;
const PATH_PARAMETER = /\{[^}]*\}/g;

function unwrap(node: ts.Node): ts.Node {
  return ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isNonNullExpression(node)
    ? unwrap(node.expression)
    : node;
}

function bindsName(binding: ts.BindingName, name: string): boolean {
  return ts.isIdentifier(binding)
    ? binding.text === name
    : binding.elements.some(
        (element) => ts.isBindingElement(element) && bindsName(element.name, name),
      );
}

/** Find lexical bindings before consulting module imports or declarations. */
function lexicalDeclaration(
  node: ts.Identifier,
  includeSource = false,
): ts.Declaration | undefined {
  for (
    let parent = node.parent;
    parent && (includeSource || !ts.isSourceFile(parent));
    parent = parent.parent
  ) {
    if (ts.isFunctionLike(parent)) {
      const parameter = parent.parameters.find((parameter) =>
        bindsName(parameter.name, node.text),
      );
      if (parameter) return parameter;
    }
    if (
      (ts.isFunctionExpression(parent) || ts.isClassExpression(parent)) &&
      parent.name?.text === node.text
    )
      return parent;
    if (
      ts.isCatchClause(parent) && parent.variableDeclaration &&
      bindsName(parent.variableDeclaration.name, node.text)
    )
      return parent.variableDeclaration;
    if (
      (ts.isForStatement(parent) || ts.isForOfStatement(parent) || ts.isForInStatement(parent)) &&
      parent.initializer && ts.isVariableDeclarationList(parent.initializer)
    ) {
      const declaration = parent.initializer.declarations.find((declaration) =>
        bindsName(declaration.name, node.text),
      );
      if (declaration) return declaration;
    }
    if (ts.isBlock(parent) || ts.isSourceFile(parent)) {
      for (const statement of parent.statements) {
        if (ts.isVariableStatement(statement)) {
          const declaration = statement.declarationList.declarations.find((declaration) =>
            bindsName(declaration.name, node.text),
          );
          if (declaration) return declaration;
        }
        if (
          (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
          statement.name?.text === node.text
        )
          return statement;
      }
    }
  }
  return;
}

function sourceModule(
  file: string,
  specifier: string,
  sources: ReadonlyMap<string, string>,
): string {
  if (!specifier.startsWith(".")) return specifier;
  const target = posix.normalize(posix.join(posix.dirname(file), specifier));
  const extension = posix.extname(target);
  const candidates = extension === ".js"
    ? [target.replace(/\.js$/, ".ts"), target.replace(/\.js$/, ".tsx"), target]
    : extension
      ? [target]
      : [target, `${target}.ts`, `${target}.tsx`, posix.join(target, "index.ts"), posix.join(target, "index.tsx")];
  return candidates.find(candidate => sources.has(candidate)) ?? target;
}

function parseModule(
  file: string,
  text: string,
  sources: ReadonlyMap<string, string>,
): Module {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const mod: Module = {
    source,
    imports: new Map(),
    exports: new Map(),
    stars: [],
    declarations: new Map(),
  };
  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      if (statement.importClause?.isTypeOnly) continue;
      const target = sourceModule(
        file,
        statement.moduleSpecifier.text,
        sources,
      );
      const defaultImport = statement.importClause?.name;
      if (defaultImport)
        mod.imports.set(defaultImport.text, { file: target, name: "default" });
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const binding of bindings.elements) {
          if (!binding.isTypeOnly)
            mod.imports.set(binding.name.text, {
              file: target,
              name: (binding.propertyName ?? binding.name).text,
            });
        }
      } else if (bindings && ts.isNamespaceImport(bindings)) {
        mod.imports.set(bindings.name.text, { file: target, name: "*" });
      }
      continue;
    }
    if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
      const target =
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier)
          ? sourceModule(file, statement.moduleSpecifier.text, sources)
          : file;
      if (!statement.exportClause) mod.stars.push(target);
      else if (ts.isNamedExports(statement.exportClause)) {
        for (const binding of statement.exportClause.elements) {
          if (!binding.isTypeOnly)
            mod.exports.set(binding.name.text, {
              file: target,
              name: (binding.propertyName ?? binding.name).text,
            });
        }
      }
      continue;
    }
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    const isDefault = modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword) ||
      (ts.isExportAssignment(statement) && !statement.isExportEquals);
    const nodes: [string, ts.Node][] = [];
    if (ts.isFunctionDeclaration(statement) && statement.body && (statement.name || isDefault))
      nodes.push([statement.name?.text ?? "default", statement]);
    if (ts.isExportAssignment(statement) && !statement.isExportEquals)
      nodes.push(["default", statement.expression]);
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer)
          nodes.push([declaration.name.text, declaration.initializer]);
      }
    }
    for (const [name, node] of nodes) {
      mod.declarations.set(name, {
        node,
        refs: new Set(),
        calls: new Set(),
        usage: { operations: [], unresolvedRequests: [], methods: [] },
        boundary: false,
        factories: new Set(),
        flags: new Set(),
      });
      if (isDefault)
        mod.exports.set("default", { file, name });
      else if (modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword))
        mod.exports.set(name, { file, name });
    }
  }
  return mod;
}

/**
 * Follow function references, imports and barrel exports to SDK calls or known
 * raw request wrappers. Dynamic paths remain diagnostics rather than guesses.
 * Boundary factories have their arguments inspected, without traversing the
 * factory's execution machinery. Reading their returned objects as data does
 * not inherit callback usage. Results describe static reachability, not a
 * complete execution trace; dynamic behavior may not be discoverable.
 */
export function analyzeSourceApiUsage(
  sources: ReadonlyMap<string, string>,
  operations: readonly SourceApiOperation[],
  options: SourceApiAnalysisOptions = {},
): SourceApiAnalysis {
  const boundaries = new Set(options.boundaries);
  const requests = new Map(options.requests?.map(request => [request.functionName, request]));
  const declarationFlags = new Set(options.declarationFlags);
  const modules = new Map(
    [...sources].map(([file, text]) => [
      file,
      parseModule(file, text, sources),
    ]),
  );
  const sdk = new Map(
    operations.map((operation) => [operation.functionName, operation]),
  );
  const identities = new Map<string, SourceApiOperation[]>();
  const pathKey = (path: string) =>
    `/${path.replace(API_PREFIX, "").split("/").filter(Boolean).join("/")}/`.replace(
      PATH_PARAMETER,
      "{}",
    );
  for (const operation of operations) {
    const key = `${operation.method}:${pathKey(operation.path)}`;
    identities.set(key, [...(identities.get(key) ?? []), operation]);
  }

  function resolve(
    binding: Binding,
    exported = false,
    seen = new Set<string>(),
  ): Binding | undefined {
    if (binding.file === SDK) return binding;
    const key = `${binding.file}#${binding.name}#${exported}`;
    if (seen.has(key)) return;
    seen.add(key);
    const mod = modules.get(binding.file);
    if (!mod) return;
    if (!exported) {
      if (mod.declarations.has(binding.name)) return binding;
      const imported = mod.imports.get(binding.name);
      return imported ? resolve(imported, true, seen) : undefined;
    }
    const next = mod.exports.get(binding.name);
    if (next) return resolve(next, next.file !== binding.file, seen);
    // A star re-export forwards named exports only, never the default export.
    if (binding.name === "default") return;
    for (const target of mod.stars) {
      const found = resolve({ file: target, name: binding.name }, true, seen);
      if (found) return found;
    }
    return;
  }

  function bindingFor(file: string, node: ts.Node): Binding | undefined {
    const mod = modules.get(file)!;
    if (ts.isIdentifier(node)) {
      if (lexicalDeclaration(node)) return;
      const imported = mod.imports.get(node.text);
      return imported
        ? resolve(imported, true) ?? (!modules.has(imported.file) ? imported : undefined)
        : resolve({ file, name: node.text });
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      !lexicalDeclaration(node.expression)
    ) {
      const namespace = mod.imports.get(node.expression.text);
      if (namespace?.name === "*")
        return resolve({ file: namespace.file, name: node.name.text }, true);
    }
    return;
  }

  /** Keep export summaries separate from the callable identity behind a default alias. */
  function callableBinding(binding: Binding | undefined): Binding | undefined {
    const seen = new Set<string>();
    while (binding?.name === "default") {
      const key = `${binding.file}#${binding.name}`;
      if (seen.has(key)) break;
      seen.add(key);
      const declaration = modules.get(binding.file)?.declarations.get(binding.name);
      if (!declaration) break;
      const node = unwrap(declaration.node);
      if (!ts.isIdentifier(node)) break;
      const target = bindingFor(binding.file, node);
      if (!target) break;
      binding = target;
    }
    return binding;
  }

  function initializer(node: ts.Node): ts.Node | undefined {
    if (!ts.isIdentifier(node)) return;
    // Parameters, destructuring and mutable bindings remain unknown: evaluating
    // their initial value would require tracking assignments and control flow.
    const declaration = lexicalDeclaration(node, true);
    return declaration && ts.isVariableDeclaration(declaration) &&
      ts.isIdentifier(declaration.name) &&
      ts.isVariableDeclarationList(declaration.parent) &&
      (declaration.parent.flags & ts.NodeFlags.Const)
      ? declaration.initializer
      : undefined;
  }

  function value(
    node: ts.Node | null | undefined,
    template = false,
    seen = new Set<ts.Node>(),
  ): string | undefined {
    if (!node || seen.has(node)) return;
    seen.add(node);
    node = unwrap(node);
    if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node))
      return node.text;
    if (node.kind === ts.SyntaxKind.TrueKeyword) return "true";
    if (node.kind === ts.SyntaxKind.FalseKeyword) return "false";
    if (ts.isIdentifier(node))
      return value(initializer(node), template, seen);
    if (ts.isTemplateExpression(node)) {
      let result = node.head.text;
      for (const span of node.templateSpans) {
        const part = value(span.expression, false, new Set(seen));
        if (part === undefined && !template) return;
        result += (part ?? "{}") + span.literal.text;
      }
      return result;
    }
    return;
  }

  /** Undefined means absent; null means an unknown object/spread can supply it. */
  function property(
    node: ts.Node | null | undefined,
    name: string,
    seen = new Set<ts.Node>(),
  ): ts.Node | null | undefined {
    if (node == null) return node;
    if (seen.has(node)) return null;
    seen.add(node);
    node = unwrap(node);
    if (ts.isIdentifier(node)) {
      const initial = initializer(node);
      return initial ? property(initial, name, seen) : null;
    }
    if (!ts.isObjectLiteralExpression(node)) return null;
    for (const member of [...node.properties].reverse()) {
      if (ts.isSpreadAssignment(member)) {
        const found = property(member.expression, name, new Set(seen));
        if (found !== undefined) return found;
        continue;
      }
      const key = ts.isComputedPropertyName(member.name)
        ? value(member.name.expression)
        : member.name.text;
      if (key === undefined) return null;
      if (key !== name) continue;
      if (ts.isPropertyAssignment(member)) return member.initializer;
      if (ts.isShorthandPropertyAssignment(member)) return member.name;
      return null;
    }
    return;
  }

  function queryTerms(
    node: ts.Node | null | undefined,
    seen = new Set<ts.Node>(),
  ): string | undefined {
    if (!node || seen.has(node)) return;
    const exact = value(node);
    if (exact !== undefined) return exact;
    seen.add(node);
    node = unwrap(node);
    if (ts.isIdentifier(node))
      return queryTerms(initializer(node), seen);
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken
    )
      return queryTerms(node.left, seen);
    if (
      !ts.isCallExpression(node) ||
      !ts.isPropertyAccessExpression(node.expression) ||
      node.expression.name.text !== "join" ||
      value(node.arguments[0]) !== " "
    )
      return;
    let array: ts.Node = node.expression.expression;
    if (
      ts.isCallExpression(array) &&
      ts.isPropertyAccessExpression(array.expression) &&
      array.expression.name.text === "filter" &&
      array.arguments[0]?.getText() === "Boolean"
    )
      array = array.expression.expression;
    if (!ts.isArrayLiteralExpression(array)) return;
    const terms = array.elements
      .map((item) => value(item))
      .filter((term): term is string => !!term);
    return terms.length ? terms.join(" ") : undefined;
  }

  function queryContext(
    requestOptions: ts.Node | undefined,
    key: string,
  ): Record<string, string> | undefined {
    const query = property(requestOptions, key);
    const result: Record<string, string> = {};
    // Only caller-selected keys are retained, rather than arbitrary options.
    for (const name of options.queryParameters ?? []) {
      const expression = property(query, name);
      const text =
        name === "query"
          ? queryTerms(expression)
          : value(expression);
      if (text) result[name] = text;
    }
    return Object.keys(result).length ? result : undefined;
  }

  for (const [file, mod] of modules) {
    for (const declaration of mod.declarations.values()) {
      function visit(node: ts.Node): void {
        if (ts.isTypeNode(node)) return;
        if (
          ts.isPropertyAssignment(node) &&
          declarationFlags.has(node.name.getText()) &&
          node.initializer.kind === ts.SyntaxKind.TrueKeyword &&
          property(node.parent, node.name.getText()) === node.initializer
        )
          declaration.flags.add(node.name.getText());
        if (
          ts.isPropertyAssignment(node) &&
          node.name.getText() === "method"
        ) {
          const method = value(node.initializer);
          if (method) declaration.usage.methods.push(method.toUpperCase());
        }
        if (ts.isCallExpression(node)) {
          const reference = bindingFor(file, node.expression);
          if (reference) declaration.calls.add(`${reference.file}#${reference.name}`);
          const binding = callableBinding(reference);
          const name =
            binding?.name ??
            (ts.isIdentifier(node.expression) && !lexicalDeclaration(node.expression)
              ? node.expression.text : "");
          if (boundaries.has(name)) {
            declaration.boundary = true;
            declaration.factories.add(name);
            for (const argument of node.arguments) visit(argument);
            return;
          }
          const operation = binding?.file === SDK ? sdk.get(name) : undefined;
          if (operation) {
            declaration.usage.operations.push({
              ...operation,
              query: queryContext(node.arguments[0], "query"),
            });
            declaration.usage.methods.push(operation.method);
            for (const argument of node.arguments) visit(argument);
            return;
          }
          const request = requests.get(name);
          if (request) {
            const requestOptions = node.arguments[request.optionsArgument];
            const methodExpression = property(requestOptions, "method");
            const method =
              methodExpression === undefined
                ? (request.defaultMethod ?? "GET").toUpperCase()
                : value(methodExpression)?.toUpperCase();
            const path = value(node.arguments[request.pathArgument], true);
            const matches =
              method && path
                ? (identities.get(`${method}:${pathKey(path)}`) ?? [])
                : [];
            if (method) declaration.usage.methods.push(method);
            if (matches.length === 1)
              declaration.usage.operations.push({
                ...matches[0]!,
                query: queryContext(requestOptions, request.queryProperty ?? "query"),
              });
            else
              declaration.usage.unresolvedRequests.push({
                file,
                line:
                  mod.source.getLineAndCharacterOfPosition(node.getStart())
                    .line + 1,
                method,
                path,
                reason:
                  !method || !path
                    ? "Dynamic request identity"
                    : matches.length
                      ? "Ambiguous catalog path"
                      : "Request is not in the public catalog",
              });
            for (const argument of node.arguments) visit(argument);
            return;
          }
        }
        if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) {
          const parent = node.parent;
          const isName =
            (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
            ((ts.isPropertyAssignment(parent) ||
              ts.isMethodDeclaration(parent) ||
              ts.isVariableDeclaration(parent) ||
              ts.isParameter(parent) ||
              ts.isFunctionDeclaration(parent)) &&
              parent.name === node);
          if (!isName) {
            const binding = bindingFor(file, node);
            if (binding && !boundaries.has(binding.name)) {
              const operation =
                binding.file === SDK ? sdk.get(binding.name) : undefined;
              if (operation) {
                declaration.usage.operations.push(operation);
                declaration.usage.methods.push(operation.method);
              } else declaration.refs.add(`${binding.file}#${binding.name}`);
            }
          }
        }
        node.forEachChild(visit);
      }
      visit(declaration.node);
    }
  }

  const declarations = new Map<string, Declaration>(
    [...modules].flatMap(([file, mod]) =>
      [...mod.declarations].map(
        ([name, declaration]) => [`${file}#${name}`, declaration] as const,
      ),
    ),
  );
  function unique<T>(items: T[]): T[] {
    return [
      ...new Map(items.map((item) => [JSON.stringify(item), item])).values(),
    ];
  }
  function isAlias(declaration: Declaration, ref: string): boolean {
    const node = unwrap(declaration.node);
    if (!ts.isIdentifier(node) && !ts.isPropertyAccessExpression(node))
      return false;
    const binding = bindingFor(node.getSourceFile().fileName, node);
    return !!binding && `${binding.file}#${binding.name}` === ref;
  }
  // Resolve boundary factories and aliases before propagating usage so objects
  // containing callbacks can be inspected as data without inheriting their calls.
  let changed = true;
  while (changed) {
    changed = false;
    for (const declaration of declarations.values()) {
      for (const ref of declaration.refs) {
        const child = declarations.get(ref);
        if (
          !child?.boundary ||
          (!declaration.calls.has(ref) && !isAlias(declaration, ref))
        )
          continue;
        if (!declaration.boundary) changed = true;
        declaration.boundary = true;
        for (const factory of child.factories) {
          if (!declaration.factories.has(factory)) changed = true;
          declaration.factories.add(factory);
        }
        for (const flag of child.flags) {
          if (!declaration.flags.has(flag)) changed = true;
          declaration.flags.add(flag);
        }
      }
    }
  }
  changed = true;
  while (changed) {
    changed = false;
    for (const declaration of declarations.values()) {
      const before = JSON.stringify(declaration.usage);
      for (const ref of declaration.refs) {
        const child = declarations.get(ref);
        if (!child) continue;
        if (
          child.boundary &&
          !ts.isFunctionLike(unwrap(child.node)) &&
          !isAlias(declaration, ref)
        )
          continue;
        declaration.usage.operations.push(...child.usage.operations);
        declaration.usage.unresolvedRequests.push(
          ...child.usage.unresolvedRequests,
        );
        declaration.usage.methods.push(...child.usage.methods);
      }
      declaration.usage.operations = unique(declaration.usage.operations);
      declaration.usage.unresolvedRequests = unique(
        declaration.usage.unresolvedRequests,
      );
      declaration.usage.methods = unique(declaration.usage.methods);
      changed ||= before !== JSON.stringify(declaration.usage);
    }
  }

  const result: SourceApiAnalysis = { exports: new Map(), boundaries: [] };
  function exportNames(file: string, seen = new Set<string>()): string[] {
    if (seen.has(file)) return [];
    seen.add(file);
    const mod = modules.get(file);
    return mod
      ? [
          ...mod.exports.keys(),
          ...mod.stars.flatMap((target) => exportNames(target, seen).filter(name => name !== "default")),
        ]
      : [];
  }
  for (const file of modules.keys()) {
    const exported = new Map<string, SourceApiUsage>();
    for (const name of new Set(exportNames(file))) {
      const binding = resolve({ file, name }, true);
      const declaration =
        binding && declarations.get(`${binding.file}#${binding.name}`);
      if (!declaration) continue;
      exported.set(name, declaration.usage);
      if (declaration.boundary)
        result.boundaries.push({
          file,
          name,
          factories: [...declaration.factories],
          flags: [...declaration.flags],
        });
    }
    result.exports.set(file, exported);
  }
  return result;
}
