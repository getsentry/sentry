import {AST_NODE_TYPES, ESLintUtils, type TSESTree} from '@typescript-eslint/utils';
import type {RuleFix, RuleFixer, Scope} from '@typescript-eslint/utils/ts-eslint';
import ts from 'typescript';

const NOT_HARDCODED = Symbol('not hardcoded');

type HardcodedValue = string | number | boolean | bigint | null;

interface DefaultValue {
  name: string;
  value: HardcodedValue;
}

interface FunctionDefaults {
  objectProperties: Map<number, Map<string, DefaultValue>>;
  positional: Map<number, DefaultValue>;
}

function getHardcodedValue(node: TSESTree.Node): HardcodedValue | typeof NOT_HARDCODED {
  if (
    node.type === AST_NODE_TYPES.TSAsExpression ||
    node.type === AST_NODE_TYPES.TSTypeAssertion ||
    node.type === AST_NODE_TYPES.TSNonNullExpression
  ) {
    return getHardcodedValue(node.expression);
  }

  if (node.type === AST_NODE_TYPES.Literal) {
    if (
      node.value === null ||
      typeof node.value === 'string' ||
      typeof node.value === 'number' ||
      typeof node.value === 'boolean' ||
      typeof node.value === 'bigint'
    ) {
      return node.value;
    }
    return NOT_HARDCODED;
  }

  if (
    node.type === AST_NODE_TYPES.TemplateLiteral &&
    node.expressions.length === 0 &&
    node.quasis[0]?.value.cooked !== null &&
    node.quasis[0]?.value.cooked !== undefined
  ) {
    return node.quasis[0].value.cooked;
  }

  if (
    node.type === AST_NODE_TYPES.UnaryExpression &&
    (node.operator === '-' || node.operator === '+') &&
    node.argument.type === AST_NODE_TYPES.Literal &&
    typeof node.argument.value === 'number'
  ) {
    return node.operator === '-' ? -node.argument.value : node.argument.value;
  }

  return NOT_HARDCODED;
}

function getPropertyName(
  key: TSESTree.PropertyName,
  computed: boolean
): string | undefined {
  if (computed) {
    return undefined;
  }
  if (key.type === AST_NODE_TYPES.Identifier) {
    return key.name;
  }
  if (
    key.type === AST_NODE_TYPES.Literal &&
    (typeof key.value === 'string' || typeof key.value === 'number')
  ) {
    return String(key.value);
  }
  return undefined;
}

function getObjectDefaults(pattern: TSESTree.ObjectPattern) {
  const defaults = new Map<string, DefaultValue>();

  for (const property of pattern.properties) {
    if (
      property.type !== AST_NODE_TYPES.Property ||
      property.value.type !== AST_NODE_TYPES.AssignmentPattern
    ) {
      continue;
    }

    const name = getPropertyName(property.key, property.computed);
    const value = getHardcodedValue(property.value.right);
    if (name !== undefined && value !== NOT_HARDCODED) {
      defaults.set(name, {name, value});
    }
  }

  return defaults;
}

function getFunctionDefaults(
  node:
    | TSESTree.ArrowFunctionExpression
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
): FunctionDefaults {
  const defaults: FunctionDefaults = {
    objectProperties: new Map(),
    positional: new Map(),
  };

  node.params.forEach((parameter, index) => {
    if (parameter.type === AST_NODE_TYPES.AssignmentPattern) {
      if (parameter.left.type === AST_NODE_TYPES.Identifier) {
        const value = getHardcodedValue(parameter.right);
        if (value !== NOT_HARDCODED) {
          defaults.positional.set(index, {name: parameter.left.name, value});
        }
      } else if (parameter.left.type === AST_NODE_TYPES.ObjectPattern) {
        const properties = getObjectDefaults(parameter.left);
        if (properties.size > 0) {
          defaults.objectProperties.set(index, properties);
        }
      }
      return;
    }

    if (parameter.type === AST_NODE_TYPES.ObjectPattern) {
      const properties = getObjectDefaults(parameter);
      if (properties.size > 0) {
        defaults.objectProperties.set(index, properties);
      }
    }
  });

  return defaults;
}

function hasDefaults(defaults: FunctionDefaults): boolean {
  return defaults.positional.size > 0 || defaults.objectProperties.size > 0;
}

function unwrapTypeScriptExpression(node: ts.Expression): ts.Expression {
  if (
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isSatisfiesExpression(node)
  ) {
    return unwrapTypeScriptExpression(node.expression);
  }
  return node;
}

function getTypeScriptHardcodedValue(
  expression: ts.Expression
): HardcodedValue | typeof NOT_HARDCODED {
  const node = unwrapTypeScriptExpression(expression);

  if (ts.isStringLiteralLike(node)) {
    return node.text;
  }
  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }
  if (ts.isBigIntLiteral(node)) {
    return BigInt(node.getText().replaceAll('_', '').slice(0, -1));
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  }
  if (ts.isPrefixUnaryExpression(node)) {
    const operand = getTypeScriptHardcodedValue(node.operand);
    if (typeof operand === 'number') {
      if (node.operator === ts.SyntaxKind.MinusToken) {
        return -operand;
      }
      if (node.operator === ts.SyntaxKind.PlusToken) {
        return operand;
      }
    }
    if (typeof operand === 'bigint' && node.operator === ts.SyntaxKind.MinusToken) {
      return -operand;
    }
  }
  return NOT_HARDCODED;
}

function getTypeScriptPropertyName(
  node: ts.BindingName | ts.PropertyName
): string | undefined {
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) {
    return node.text;
  }
  if (ts.isNumericLiteral(node)) {
    return String(Number(node.text));
  }
  return undefined;
}

function getTypeScriptObjectDefaults(pattern: ts.ObjectBindingPattern) {
  const defaults = new Map<string, DefaultValue>();

  for (const element of pattern.elements) {
    if (element.dotDotDotToken || !element.initializer) {
      continue;
    }

    const name = getTypeScriptPropertyName(element.propertyName ?? element.name);
    const value = getTypeScriptHardcodedValue(element.initializer);
    if (name !== undefined && value !== NOT_HARDCODED) {
      defaults.set(name, {name, value});
    }
  }

  return defaults;
}

function getTypeScriptFunctionDefaults(
  node: ts.SignatureDeclarationBase
): FunctionDefaults {
  const defaults: FunctionDefaults = {
    objectProperties: new Map(),
    positional: new Map(),
  };
  let runtimeIndex = 0;

  for (const parameter of node.parameters) {
    if (ts.isIdentifier(parameter.name) && parameter.name.text === 'this') {
      continue;
    }

    if (parameter.initializer && ts.isIdentifier(parameter.name)) {
      const value = getTypeScriptHardcodedValue(parameter.initializer);
      if (value !== NOT_HARDCODED) {
        defaults.positional.set(runtimeIndex, {
          name: parameter.name.text,
          value,
        });
      }
    } else if (ts.isObjectBindingPattern(parameter.name)) {
      const properties = getTypeScriptObjectDefaults(parameter.name);
      if (properties.size > 0) {
        defaults.objectProperties.set(runtimeIndex, properties);
      }
    }

    runtimeIndex++;
  }

  return defaults;
}

function getFunctionLikeDeclaration(
  declaration: ts.Declaration
): ts.SignatureDeclarationBase | undefined {
  if (
    ts.isFunctionDeclaration(declaration) ||
    ts.isFunctionExpression(declaration) ||
    ts.isArrowFunction(declaration)
  ) {
    return declaration;
  }
  if (!ts.isVariableDeclaration(declaration) || !declaration.initializer) {
    return undefined;
  }

  const initializer = unwrapTypeScriptExpression(declaration.initializer);
  return ts.isFunctionExpression(initializer) || ts.isArrowFunction(initializer)
    ? initializer
    : undefined;
}

interface SyntacticResolver {
  defaultsByExport: Map<string, FunctionDefaults | null>;
  moduleResolutionCache: ts.ModuleResolutionCache;
  options: ts.CompilerOptions;
  sourceFiles: Map<string, CachedSourceFile>;
}

interface CachedSourceFile {
  modifiedTime: number | undefined;
  sourceFile: ts.SourceFile | null;
}

const configPathByDirectory = new Map<string, string | null>();
const resolverByConfig = new Map<string, SyntacticResolver | null>();
// Oxlint keeps JS plugin modules alive in the LSP. Index cached source files so
// relinting an edited dependency can refresh its AST without rebuilding a Program.
const resolversBySourceFile = new Map<string, Set<SyntacticResolver>>();

function getDirectory(fileName: string): string {
  return fileName.replace(/[/\\][^/\\]+$/u, '');
}

function getConfigPath(fileName: string): string | undefined {
  const directory = getDirectory(fileName);
  if (!configPathByDirectory.has(directory)) {
    configPathByDirectory.set(
      directory,
      ts.findConfigFile(directory, ts.sys.fileExists, 'tsconfig.json') ?? null
    );
  }
  return configPathByDirectory.get(directory) ?? undefined;
}

function createSyntacticResolver(configPath: string): SyntacticResolver | undefined {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      // Module resolution only needs the inherited compiler options. Avoid
      // enumerating every project file for each new lint process.
      readDirectory: () => [],
      onUnRecoverableConfigFileDiagnostic: () => {},
    }
  );
  if (!parsed) {
    return undefined;
  }

  const configDirectory = getDirectory(configPath);
  return {
    defaultsByExport: new Map(),
    moduleResolutionCache: ts.createModuleResolutionCache(
      configDirectory,
      fileName => (ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase()),
      parsed.options
    ),
    options: parsed.options,
    sourceFiles: new Map(),
  };
}

function getSyntacticResolver(fileName: string): SyntacticResolver | undefined {
  const configPath = getConfigPath(fileName);
  if (!configPath) {
    return undefined;
  }
  if (!resolverByConfig.has(configPath)) {
    resolverByConfig.set(configPath, createSyntacticResolver(configPath) ?? null);
  }
  return resolverByConfig.get(configPath) ?? undefined;
}

function parseSourceFile(fileName: string, source: string): ts.SourceFile {
  return ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    false,
    fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}

function updateCachedSourceFile(fileName: string, source: string): void {
  const resolvedFileName = ts.sys.resolvePath(fileName);
  const resolvers = resolversBySourceFile.get(resolvedFileName);
  if (!resolvers) {
    return;
  }

  const staleResolvers = [...resolvers].filter(
    resolver => resolver.sourceFiles.get(resolvedFileName)?.sourceFile?.text !== source
  );
  if (staleResolvers.length === 0) {
    return;
  }

  const sourceFile = parseSourceFile(resolvedFileName, source);
  const modifiedTime = ts.sys.getModifiedTime?.(resolvedFileName)?.getTime();
  for (const resolver of staleResolvers) {
    resolver.sourceFiles.set(resolvedFileName, {modifiedTime, sourceFile});
  }
}

function getSourceFile(
  resolver: SyntacticResolver,
  fileName: string
): ts.SourceFile | undefined {
  const resolvedFileName = ts.sys.resolvePath(fileName);
  const modifiedTime = ts.sys.getModifiedTime?.(resolvedFileName)?.getTime();
  const cached = resolver.sourceFiles.get(resolvedFileName);
  if (cached && modifiedTime !== undefined && cached.modifiedTime === modifiedTime) {
    return cached.sourceFile ?? undefined;
  }

  const source = ts.sys.readFile(resolvedFileName);
  const sourceFile = source ? parseSourceFile(resolvedFileName, source) : undefined;
  const cachedSourceFile = sourceFile ?? null;
  resolver.sourceFiles.set(resolvedFileName, {
    modifiedTime,
    sourceFile: cachedSourceFile,
  });
  const resolvers = resolversBySourceFile.get(resolvedFileName) ?? new Set();
  resolvers.add(resolver);
  resolversBySourceFile.set(resolvedFileName, resolvers);
  return sourceFile;
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return Boolean(
    ts.canHaveModifiers(node) &&
    ts.getModifiers(node)?.some(modifier => modifier.kind === kind)
  );
}

function getVariableDefaults(
  declarations: ts.NodeArray<ts.VariableDeclaration>,
  name: string
): FunctionDefaults | undefined {
  for (const declaration of declarations) {
    if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) {
      continue;
    }
    const functionDeclaration = getFunctionLikeDeclaration(declaration);
    if (functionDeclaration) {
      const defaults = getTypeScriptFunctionDefaults(functionDeclaration);
      if (hasDefaults(defaults)) {
        return defaults;
      }
    }
  }
  return undefined;
}

function resolveModuleExport(
  resolver: SyntacticResolver,
  containingFile: string,
  moduleSpecifier: string,
  exportName: string,
  seen: Set<string>
): FunctionDefaults | undefined {
  const resolvedFileName = ts.resolveModuleName(
    moduleSpecifier,
    containingFile,
    resolver.options,
    ts.sys,
    resolver.moduleResolutionCache
  ).resolvedModule?.resolvedFileName;
  return resolvedFileName
    ? resolveExportedDefaults(resolver, resolvedFileName, exportName, seen)
    : undefined;
}

function resolveLocalDefaults(
  resolver: SyntacticResolver,
  sourceFile: ts.SourceFile,
  name: string,
  seen: Set<string>
): FunctionDefaults | undefined {
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) {
      const defaults = getTypeScriptFunctionDefaults(statement);
      if (hasDefaults(defaults)) {
        return defaults;
      }
    }

    if (ts.isVariableStatement(statement)) {
      const defaults = getVariableDefaults(statement.declarationList.declarations, name);
      if (defaults) {
        return defaults;
      }
    }

    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteralLike(statement.moduleSpecifier)
    ) {
      const importClause = statement.importClause;
      if (importClause?.name?.text === name) {
        return resolveModuleExport(
          resolver,
          sourceFile.fileName,
          statement.moduleSpecifier.text,
          'default',
          seen
        );
      }

      const imports = importClause?.namedBindings;
      if (imports && ts.isNamedImports(imports)) {
        const imported = imports.elements.find(element => element.name.text === name);
        if (imported) {
          return resolveModuleExport(
            resolver,
            sourceFile.fileName,
            statement.moduleSpecifier.text,
            (imported.propertyName ?? imported.name).text,
            seen
          );
        }
      }
    }
  }
  return undefined;
}

function resolveExportedDefaults(
  resolver: SyntacticResolver,
  fileName: string,
  exportName: string,
  seen: Set<string>
): FunctionDefaults | undefined {
  const resolvedFileName = ts.sys.resolvePath(fileName);
  const cacheKey = `${resolvedFileName}\0${exportName}`;
  if (resolver.defaultsByExport.has(cacheKey)) {
    return resolver.defaultsByExport.get(cacheKey) ?? undefined;
  }
  if (seen.has(cacheKey)) {
    return undefined;
  }
  seen.add(cacheKey);

  const sourceFile = getSourceFile(resolver, resolvedFileName);
  if (!sourceFile) {
    seen.delete(cacheKey);
    resolver.defaultsByExport.set(cacheKey, null);
    return undefined;
  }

  let defaults: FunctionDefaults | undefined;
  if (exportName === 'default') {
    for (const statement of sourceFile.statements) {
      if (
        ts.isFunctionDeclaration(statement) &&
        hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
      ) {
        const candidate = getTypeScriptFunctionDefaults(statement);
        if (hasDefaults(candidate)) {
          defaults = candidate;
          break;
        }
      }
      if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
        const expression = unwrapTypeScriptExpression(statement.expression);
        if (ts.isFunctionExpression(expression) || ts.isArrowFunction(expression)) {
          const candidate = getTypeScriptFunctionDefaults(expression);
          if (hasDefaults(candidate)) {
            defaults = candidate;
            break;
          }
        } else if (ts.isIdentifier(expression)) {
          defaults = resolveLocalDefaults(resolver, sourceFile, expression.text, seen);
          if (defaults) {
            break;
          }
        }
      }
    }
  } else {
    for (const statement of sourceFile.statements) {
      if (
        ts.isFunctionDeclaration(statement) &&
        statement.name?.text === exportName &&
        hasModifier(statement, ts.SyntaxKind.ExportKeyword)
      ) {
        const candidate = getTypeScriptFunctionDefaults(statement);
        if (hasDefaults(candidate)) {
          defaults = candidate;
          break;
        }
      }
      if (
        ts.isVariableStatement(statement) &&
        hasModifier(statement, ts.SyntaxKind.ExportKeyword)
      ) {
        defaults = getVariableDefaults(
          statement.declarationList.declarations,
          exportName
        );
        if (defaults) {
          break;
        }
      }
    }
  }

  if (!defaults) {
    for (const statement of sourceFile.statements) {
      if (!ts.isExportDeclaration(statement)) {
        continue;
      }

      const moduleSpecifier =
        statement.moduleSpecifier && ts.isStringLiteralLike(statement.moduleSpecifier)
          ? statement.moduleSpecifier.text
          : undefined;
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        const exported = statement.exportClause.elements.find(
          element => element.name.text === exportName
        );
        if (!exported) {
          continue;
        }
        const localName = (exported.propertyName ?? exported.name).text;
        defaults = moduleSpecifier
          ? resolveModuleExport(
              resolver,
              sourceFile.fileName,
              moduleSpecifier,
              localName,
              seen
            )
          : resolveLocalDefaults(resolver, sourceFile, localName, seen);
      } else if (moduleSpecifier && exportName !== 'default') {
        defaults = resolveModuleExport(
          resolver,
          sourceFile.fileName,
          moduleSpecifier,
          exportName,
          seen
        );
      }

      if (defaults) {
        break;
      }
    }
  }

  seen.delete(cacheKey);
  resolver.defaultsByExport.set(cacheKey, defaults ?? null);
  return defaults;
}

function getImportedBinding(
  variable: Scope.Variable
): {exportName: string; moduleSpecifier: string} | undefined {
  const definition = variable.defs.find(candidate => candidate.type === 'ImportBinding');
  if (
    !definition ||
    definition.parent?.type !== AST_NODE_TYPES.ImportDeclaration ||
    typeof definition.parent.source.value !== 'string'
  ) {
    return undefined;
  }

  switch (definition.node.type) {
    case AST_NODE_TYPES.ImportDefaultSpecifier:
      return {
        exportName: 'default',
        moduleSpecifier: definition.parent.source.value,
      };
    case AST_NODE_TYPES.ImportSpecifier:
      return {
        exportName:
          definition.node.imported.type === AST_NODE_TYPES.Identifier
            ? definition.node.imported.name
            : String(definition.node.imported.value),
        moduleSpecifier: definition.parent.source.value,
      };
    default:
      return undefined;
  }
}

function getSyntacticImportedDefaults(
  resolver: SyntacticResolver,
  fileName: string,
  variable: Scope.Variable
): FunctionDefaults | undefined {
  const imported = getImportedBinding(variable);
  return imported
    ? resolveModuleExport(
        resolver,
        fileName,
        imported.moduleSpecifier,
        imported.exportName,
        new Set()
      )
    : undefined;
}

function objectExpressionHasHardcodedCandidate(node: TSESTree.ObjectExpression): boolean {
  if (node.properties.some(property => property.type === AST_NODE_TYPES.SpreadElement)) {
    return false;
  }

  return node.properties.some(
    property =>
      property.type === AST_NODE_TYPES.Property &&
      getPropertyName(property.key, property.computed) !== undefined &&
      getHardcodedValue(property.value) !== NOT_HARDCODED
  );
}

function callHasHardcodedCandidate(node: TSESTree.CallExpression): boolean {
  const spreadIndex = node.arguments.findIndex(
    argument => argument.type === AST_NODE_TYPES.SpreadElement
  );
  const alignedArgumentCount = spreadIndex === -1 ? node.arguments.length : spreadIndex;

  if (spreadIndex === -1) {
    const lastArgument = node.arguments.at(-1);
    if (lastArgument && getHardcodedValue(lastArgument) !== NOT_HARDCODED) {
      return true;
    }
  }

  return node.arguments
    .slice(0, alignedArgumentCount)
    .some(
      argument =>
        argument.type === AST_NODE_TYPES.ObjectExpression &&
        objectExpressionHasHardcodedCandidate(argument)
    );
}

function getJSXAttributeValue(
  attribute: TSESTree.JSXAttribute
): HardcodedValue | typeof NOT_HARDCODED {
  if (!attribute.value) {
    return true;
  }
  if (attribute.value.type === AST_NODE_TYPES.JSXExpressionContainer) {
    return getHardcodedValue(attribute.value.expression);
  }
  return getHardcodedValue(attribute.value);
}

function elementHasHardcodedCandidate(node: TSESTree.JSXOpeningElement): boolean {
  if (
    node.attributes.some(
      attribute => attribute.type === AST_NODE_TYPES.JSXSpreadAttribute
    )
  ) {
    return false;
  }

  return node.attributes.some(
    attribute =>
      attribute.type === AST_NODE_TYPES.JSXAttribute &&
      attribute.name.type === AST_NODE_TYPES.JSXIdentifier &&
      getJSXAttributeValue(attribute) !== NOT_HARDCODED
  );
}

function formatHardcodedValue(value: HardcodedValue): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'bigint') {
    return `${value}n`;
  }
  if (typeof value === 'number' && Object.is(value, -0)) {
    return '-0';
  }
  return String(value);
}

export const noRedundantDefaultArgument = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow hardcoded function arguments and JSX props that equal their local default value.',
    },
    fixable: 'code',
    schema: [],
    messages: {
      redundantDefaultValue:
        'Do not pass the default value ({{value}}) for "{{name}}". Omit this {{kind}}.',
    },
  },
  create(context) {
    const currentFileName = ts.sys.resolvePath(context.filename);
    updateCachedSourceFile(currentFileName, context.sourceCode.text);
    const defaultsByVariable = new Map<Scope.Variable, FunctionDefaults>();
    const importedDefaultsByVariable = new Map<Scope.Variable, FunctionDefaults | null>();
    const stableByVariable = new WeakMap<Scope.Variable, boolean>();
    let syntacticResolver: SyntacticResolver | null | undefined;
    const calls: Array<{
      node: TSESTree.CallExpression;
      variable: Scope.Variable;
    }> = [];
    const elements: Array<{
      node: TSESTree.JSXOpeningElement;
      variable: Scope.Variable;
    }> = [];

    function resolveVariable(node: TSESTree.Identifier | TSESTree.JSXIdentifier) {
      let scope: Scope.Scope | null = context.sourceCode.getScope(node);
      while (scope) {
        const variable = scope.set.get(node.name);
        if (variable) {
          return variable;
        }
        scope = scope.upper;
      }
      return;
    }

    function getImportedDefaults(variable: Scope.Variable) {
      if (importedDefaultsByVariable.has(variable)) {
        return importedDefaultsByVariable.get(variable);
      }

      if (!getImportedBinding(variable)) {
        importedDefaultsByVariable.set(variable, null);
        return;
      }

      if (syntacticResolver === undefined) {
        syntacticResolver = getSyntacticResolver(currentFileName) ?? null;
        syntacticResolver?.defaultsByExport.clear();
        syntacticResolver?.moduleResolutionCache.clear();
      }
      const defaults = syntacticResolver
        ? getSyntacticImportedDefaults(syntacticResolver, currentFileName, variable)
        : undefined;
      importedDefaultsByVariable.set(variable, defaults ?? null);
      return defaults;
    }

    function getDefaults(variable: Scope.Variable) {
      return defaultsByVariable.get(variable) ?? getImportedDefaults(variable);
    }

    function registerFunction(
      identifier: TSESTree.Identifier,
      node:
        | TSESTree.ArrowFunctionExpression
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
    ) {
      const defaults = getFunctionDefaults(node);
      if (!hasDefaults(defaults)) {
        return;
      }

      const variable = resolveVariable(identifier);
      if (variable) {
        defaultsByVariable.set(variable, defaults);
      }
    }

    function report(
      node: TSESTree.Node,
      defaultValue: DefaultValue,
      kind: string,
      fix?: (fixer: RuleFixer) => RuleFix | RuleFix[] | null
    ) {
      context.report({
        node,
        messageId: 'redundantDefaultValue',
        data: {
          kind,
          name: defaultValue.name,
          value: formatHardcodedValue(defaultValue.value),
        },
        ...(fix ? {fix} : {}),
      });
    }

    function rangeContainsComment(range: TSESTree.Range) {
      return context.sourceCode
        .getAllComments()
        .some(comment => comment.range[0] >= range[0] && comment.range[1] <= range[1]);
    }

    function removeTrailingArguments(
      fixer: RuleFixer,
      node: TSESTree.CallExpression,
      firstIndex: number
    ) {
      const firstArgument = node.arguments[firstIndex];
      const lastArgument = node.arguments.at(-1);
      if (!firstArgument || !lastArgument) {
        return null;
      }

      let rangeStart = firstArgument.range[0];
      if (firstIndex > 0) {
        const previousArgument = node.arguments[firstIndex - 1];
        if (!previousArgument) {
          return null;
        }
        rangeStart = previousArgument.range[1];
      }

      const tokenAfter = context.sourceCode.getTokenAfter(lastArgument);
      const range: TSESTree.Range = [
        rangeStart,
        tokenAfter?.value === ',' ? tokenAfter.range[1] : lastArgument.range[1],
      ];
      return rangeContainsComment(range) ? null : fixer.removeRange(range);
    }

    function getContiguousRuns(indices: number[]) {
      const runs: Array<{end: number; start: number}> = [];
      for (const index of indices) {
        const previous = runs.at(-1);
        if (previous?.end === index - 1) {
          previous.end = index;
        } else {
          runs.push({end: index, start: index});
        }
      }
      return runs;
    }

    function removeObjectProperties(
      fixer: RuleFixer,
      node: TSESTree.ObjectExpression,
      indices: number[]
    ) {
      const ranges: TSESTree.Range[] = [];
      for (const {end, start} of getContiguousRuns(indices)) {
        const firstProperty = node.properties[start];
        const lastProperty = node.properties[end];
        if (!firstProperty || !lastProperty) {
          return null;
        }

        const nextProperty = node.properties[end + 1];
        if (nextProperty) {
          ranges.push([firstProperty.range[0], nextProperty.range[0]]);
          continue;
        }

        let rangeStart = firstProperty.range[0];
        if (start > 0) {
          const previousProperty = node.properties[start - 1];
          if (!previousProperty) {
            return null;
          }
          rangeStart = previousProperty.range[1];
        }

        const tokenAfter = context.sourceCode.getTokenAfter(lastProperty);
        ranges.push([
          rangeStart,
          tokenAfter?.value === ',' ? tokenAfter.range[1] : lastProperty.range[1],
        ]);
      }

      if (ranges.some(rangeContainsComment)) {
        return null;
      }
      return ranges.map(range => fixer.removeRange(range));
    }

    function removeJSXAttributes(
      fixer: RuleFixer,
      node: TSESTree.JSXOpeningElement,
      indices: number[]
    ) {
      const ranges: TSESTree.Range[] = [];
      for (const {end, start} of getContiguousRuns(indices)) {
        const firstAttribute = node.attributes[start];
        const lastAttribute = node.attributes[end];
        if (!firstAttribute || !lastAttribute) {
          return null;
        }

        const nextAttribute = node.attributes[end + 1];
        if (nextAttribute) {
          ranges.push([firstAttribute.range[0], nextAttribute.range[0]]);
          continue;
        }

        let rangeStart = node.name.range[1];
        if (start > 0) {
          const previousAttribute = node.attributes[start - 1];
          if (!previousAttribute) {
            return null;
          }
          rangeStart = previousAttribute.range[1];
        }
        ranges.push([rangeStart, lastAttribute.range[1]]);
      }

      if (ranges.some(rangeContainsComment)) {
        return null;
      }
      return ranges.map(range => fixer.removeRange(range));
    }

    function isStable(variable: Scope.Variable) {
      if (stableByVariable.has(variable)) {
        return stableByVariable.get(variable)!;
      }

      const stable = !variable.references.some(
        reference => reference.isWrite() && !reference.init
      );
      stableByVariable.set(variable, stable);
      return stable;
    }

    function checkObjectExpression(
      node: TSESTree.ObjectExpression,
      defaults: Map<string, DefaultValue>
    ) {
      const seen = new Set<string>();
      const redundantProperties: Array<{
        defaultValue: DefaultValue;
        index: number;
        property: TSESTree.Property;
      }> = [];

      for (let index = node.properties.length - 1; index >= 0; index--) {
        const property = node.properties[index];
        if (!property) {
          continue;
        }
        if (property.type === AST_NODE_TYPES.SpreadElement) {
          return;
        }
        if (property.type !== AST_NODE_TYPES.Property) {
          continue;
        }

        const name = getPropertyName(property.key, property.computed);
        if (name === undefined || seen.has(name)) {
          continue;
        }
        seen.add(name);

        const defaultValue = defaults.get(name);
        const value = getHardcodedValue(property.value);
        if (
          defaultValue &&
          value !== NOT_HARDCODED &&
          Object.is(value, defaultValue.value)
        ) {
          redundantProperties.push({defaultValue, index, property});
        }
      }

      redundantProperties.reverse();
      const indices = redundantProperties.map(({index}) => index);
      redundantProperties.forEach(({defaultValue, property}, index) => {
        report(
          property,
          defaultValue,
          'property',
          index === 0 ? fixer => removeObjectProperties(fixer, node, indices) : undefined
        );
      });
    }

    function checkCall(node: TSESTree.CallExpression, defaults: FunctionDefaults) {
      const spreadIndex = node.arguments.findIndex(
        argument => argument.type === AST_NODE_TYPES.SpreadElement
      );

      if (spreadIndex === -1) {
        let firstRedundantPosition = node.arguments.length;

        for (let index = node.arguments.length - 1; index >= 0; index--) {
          const argument = node.arguments[index];
          if (!argument) {
            break;
          }
          const defaultValue = defaults.positional.get(index);
          const value = getHardcodedValue(argument);
          if (
            !defaultValue ||
            value === NOT_HARDCODED ||
            !Object.is(value, defaultValue.value)
          ) {
            break;
          }
          firstRedundantPosition = index;
        }

        for (let index = firstRedundantPosition; index < node.arguments.length; index++) {
          const argument = node.arguments[index];
          const defaultValue = defaults.positional.get(index);
          if (!argument || !defaultValue) {
            continue;
          }
          report(
            argument,
            defaultValue,
            'argument',
            index === firstRedundantPosition
              ? fixer => removeTrailingArguments(fixer, node, firstRedundantPosition)
              : undefined
          );
        }
      }

      const alignedArgumentCount =
        spreadIndex === -1 ? node.arguments.length : spreadIndex;
      node.arguments.slice(0, alignedArgumentCount).forEach((argument, index) => {
        const objectDefaults = defaults.objectProperties.get(index);
        if (argument.type === AST_NODE_TYPES.ObjectExpression && objectDefaults) {
          checkObjectExpression(argument, objectDefaults);
        }
      });
    }

    function checkElement(node: TSESTree.JSXOpeningElement, defaults: FunctionDefaults) {
      const propDefaults = defaults.objectProperties.get(0);
      if (!propDefaults) {
        return;
      }

      const seen = new Set<string>();
      const redundantAttributes: Array<{
        attribute: TSESTree.JSXAttribute;
        defaultValue: DefaultValue;
        index: number;
      }> = [];
      for (let index = node.attributes.length - 1; index >= 0; index--) {
        const attribute = node.attributes[index];
        if (!attribute) {
          continue;
        }
        if (attribute.type === AST_NODE_TYPES.JSXSpreadAttribute) {
          return;
        }
        if (attribute.name.type !== AST_NODE_TYPES.JSXIdentifier) {
          continue;
        }

        const name = attribute.name.name;
        if (seen.has(name)) {
          continue;
        }
        seen.add(name);

        const defaultValue = propDefaults.get(name);
        if (!defaultValue) {
          continue;
        }

        const value = getJSXAttributeValue(attribute);

        if (value !== NOT_HARDCODED && Object.is(value, defaultValue.value)) {
          redundantAttributes.push({attribute, defaultValue, index});
        }
      }

      redundantAttributes.reverse();
      const indices = redundantAttributes.map(({index}) => index);
      redundantAttributes.forEach(({attribute, defaultValue}, index) => {
        report(
          attribute,
          defaultValue,
          'prop',
          index === 0 ? fixer => removeJSXAttributes(fixer, node, indices) : undefined
        );
      });
    }

    return {
      FunctionDeclaration(node) {
        if (node.id) {
          registerFunction(node.id, node);
        }
      },

      VariableDeclarator(node) {
        if (
          node.parent.kind === 'const' &&
          node.id.type === AST_NODE_TYPES.Identifier &&
          (node.init?.type === AST_NODE_TYPES.ArrowFunctionExpression ||
            node.init?.type === AST_NODE_TYPES.FunctionExpression)
        ) {
          registerFunction(node.id, node.init);
        }
      },

      CallExpression(node) {
        if (
          node.callee.type !== AST_NODE_TYPES.Identifier ||
          !callHasHardcodedCandidate(node)
        ) {
          return;
        }
        const variable = resolveVariable(node.callee);
        if (variable) {
          calls.push({node, variable});
        }
      },

      JSXOpeningElement(node) {
        if (
          node.name.type !== AST_NODE_TYPES.JSXIdentifier ||
          node.name.name[0] !== node.name.name[0]?.toUpperCase() ||
          !elementHasHardcodedCandidate(node)
        ) {
          return;
        }
        const variable = resolveVariable(node.name);
        if (variable) {
          elements.push({node, variable});
        }
      },

      'Program:exit'() {
        for (const {node, variable} of calls) {
          if (!isStable(variable)) {
            continue;
          }
          if (node.callee.type !== AST_NODE_TYPES.Identifier) {
            continue;
          }
          const defaults = getDefaults(variable);
          if (defaults) {
            checkCall(node, defaults);
          }
        }
        for (const {node, variable} of elements) {
          if (!isStable(variable)) {
            continue;
          }
          if (node.name.type !== AST_NODE_TYPES.JSXIdentifier) {
            continue;
          }
          const defaults = getDefaults(variable);
          if (defaults) {
            checkElement(node, defaults);
          }
        }
      },
    };
  },
});
