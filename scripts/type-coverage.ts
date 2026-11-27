#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';

import * as ts from 'tsrs/ast';
import {
  API,
  type Checker,
  formatDiagnostics,
  SignatureKind,
  type Type,
  TypeFlags,
} from 'tsrs/sync';

// Terminal color codes
const colors = {
  red: (text: string) => `\x1B[31m${text}\x1B[0m`,
  green: (text: string) => `\x1B[32m${text}\x1B[0m`,
  yellow: (text: string) => `\x1B[33m${text}\x1B[0m`,
  cyan: (text: string) => `\x1B[36m${text}\x1B[0m`,
  magenta: (text: string) => `\x1B[35m${text}\x1B[0m`,
  bold: (text: string) => `\x1B[1m${text}\x1B[0m`,
  dim: (text: string) => `\x1B[2m${text}\x1B[0m`,
};

type Options = {
  tsconfigPath: string;
  detail?: boolean;
  failBelow?: number;
  ignoreFiles?: string[];
  json?: boolean;
  listAny?: boolean;
  listNonNull?: boolean;
  listTypeAssertions?: boolean;
};

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const opts: Options = {tsconfigPath: 'tsconfig.json'};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--fail-below') {
      opts.failBelow = Number(args[++i]);
    } else if (a === '--json') {
      opts.json = true;
    } else if (a === '--project' || a === '-p') {
      opts.tsconfigPath = args[++i]!;
    } else if (a === '--list-any') {
      opts.listAny = true;
    } else if (a === '--list-nonnull') {
      opts.listNonNull = true;
    } else if (a === '--list-type-assertions') {
      opts.listTypeAssertions = true;
    } else if (a === '--detail') {
      opts.detail = true;
    } else if (a === '--ignore-files') {
      if (!opts.ignoreFiles) {
        opts.ignoreFiles = [];
      }
      opts.ignoreFiles.push(args[++i]!);
    }
  }
  return opts;
}

function getTypeParameters(type: Type): readonly ts.TypeParameterDeclaration[] {
  const symbol = type.getAliasSymbol() ?? type.getSymbol();
  const declaration = symbol?.declarations
    .find(
      handle =>
        ts.isClassDeclaration.Handle(handle) ||
        ts.isInterfaceDeclaration.Handle(handle) ||
        ts.isTypeAliasDeclaration.Handle(handle)
    )
    ?.resolve();
  return declaration?.typeParameters ?? [];
}

function hasAnyTypeArgument(
  typeArguments: readonly Type[],
  typeParameters: readonly ts.TypeParameterDeclaration[],
  typeChecker: Checker
): boolean {
  return typeArguments.some((typeArgument, index) => {
    if (!(typeArgument.flags & TypeFlags.Any)) {
      return false;
    }

    const defaultType = typeParameters[index]?.defaultType;
    return (
      !defaultType ||
      !(typeChecker.getTypeFromTypeNode(defaultType).flags & TypeFlags.Any)
    );
  });
}

function hasDirectAnyTypeArgument(type: Type, typeChecker: Checker): boolean {
  // tsrs returns an empty list instead of undefined when a type has no alias
  // type arguments, so check whether the alias itself is generic.
  const aliasTypeParameters = type.getAliasSymbol() ? getTypeParameters(type) : [];
  if (aliasTypeParameters.length > 0) {
    return hasAnyTypeArgument(
      type.getAliasTypeArguments(),
      aliasTypeParameters,
      typeChecker
    );
  }

  if (type.isTypeReference()) {
    return hasAnyTypeArgument(
      typeChecker.getTypeArguments(type),
      getTypeParameters(type.getTarget()),
      typeChecker
    );
  }

  return false;
}

// Each check asks the tsrs server about the type, so remember the answer.
const isAnyCache = new Map<number, boolean>();

const isAny = (type: Type, typeChecker: Checker): boolean =>
  isAnyCache.getOrInsertComputed(type.id, () => isAnyUncached(type, typeChecker));

function isAnyUncached(type: Type, typeChecker: Checker): boolean {
  if (type.flags & TypeFlags.Any) {
    return true;
  }

  if (hasDirectAnyTypeArgument(type, typeChecker)) {
    return true;
  }

  // Check union members after direct arguments to support aliases like Maybe<any>.
  if (type.isUnionType() || type.isIntersectionType()) {
    return type.getTypes().some(member => isAny(member, typeChecker));
  }

  return false;
}

function hasExplicitType(
  node: ts.VariableDeclaration | ts.ParameterDeclaration
): boolean {
  return !!node.type;
}

// Fetch the types of every declaration in a file in one request. A request per
// declaration is much slower.
function getDeclarationTypes(
  sourceFile: ts.SourceFile,
  typeChecker: Checker
): Map<ts.Node, Type> {
  const declarations: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) ||
      ts.isParameterDeclaration(node) ||
      ts.isBindingElement(node)
    ) {
      declarations.push(node);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);

  const types = typeChecker.getTypeAtLocation(declarations);
  return new Map(declarations.map((node, index) => [node, types[index]!]));
}

function isContextuallyTypedCallbackParam(
  param: ts.ParameterDeclaration,
  typeChecker: Checker
): boolean {
  const parent = param.parent;
  if (!ts.isFunctionExpression(parent) && !ts.isArrowFunction(parent)) {
    return false;
  }

  // Check for styled-components pattern: styled('div')`...${p => ...}...`
  let current: ts.Node | undefined = parent.parent;
  while (current) {
    // Check if we're in a tagged template expression
    if (ts.isTaggedTemplateExpression(current)) {
      const tagText = current.tag.getText();
      // Match styled, chonkStyled, or any variation ending with 'styled'
      if (/styled/i.test(tagText) || tagText.toLowerCase().includes('styled')) {
        return true;
      }
    }
    // Also check template expressions and spans
    if (
      ts.isTemplateExpression(current) ||
      ts.isTemplateSpan(current) ||
      ts.isNoSubstitutionTemplateLiteral(current)
    ) {
      const taggedTemplate = current.parent;
      if (ts.isTaggedTemplateExpression(taggedTemplate)) {
        const tagText = taggedTemplate.tag.getText();
        if (/styled/i.test(tagText) || tagText.toLowerCase().includes('styled')) {
          return true;
        }
      }
    }
    current = current.parent;
  }

  // Original contextual type checking
  const contextualType = typeChecker.getContextualType(parent);
  if (!contextualType) {
    return false;
  }

  const signatures = typeChecker.getSignaturesOfType(contextualType, SignatureKind.Call);
  if (signatures.length === 0) {
    return false;
  }

  const sig = signatures[0]!;
  const paramIndex = parent.parameters.indexOf(param);
  if (paramIndex < 0 || paramIndex >= sig.parameters.length) {
    return false;
  }

  return true;
}

type AnyHit = {
  column: number;
  file: string;
  kind: 'var' | 'var(binding)' | 'param' | 'param(binding)' | 'as-any';
  line: number;
  name: string;
};

type NonNullHit = {
  code: string;
  column: number;
  file: string;
  kind: 'nonnull(expr)' | 'nonnull(property)';
  line: number;
};

type TypeAssertionHit = {
  code: string;
  column: number;
  file: string;
  kind: 'type(as)' | 'type(angle)';
  line: number;
  targetType: string;
};

function recordAny(
  hits: AnyHit[],
  sourceFile: ts.SourceFile,
  node: ts.Node,
  kind: AnyHit['kind'],
  name: string
) {
  const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const relPath = path.relative(process.cwd(), sourceFile.fileName);

  hits.push({file: relPath, line: pos.line + 1, column: pos.character + 1, kind, name});
}

function recordNonNull(
  hits: NonNullHit[],
  sourceFile: ts.SourceFile,
  node: ts.Node,
  kind: NonNullHit['kind']
) {
  const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const relPath = path.relative(process.cwd(), sourceFile.fileName);
  const code = textPreview(node.getText(sourceFile));
  hits.push({file: relPath, line: pos.line + 1, column: pos.character + 1, kind, code});
}

function recordTypeAssertion(
  hits: TypeAssertionHit[],
  sourceFile: ts.SourceFile,
  node: ts.Node,
  kind: TypeAssertionHit['kind'],
  targetType: string
) {
  const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const relPath = path.relative(process.cwd(), sourceFile.fileName);
  const code = textPreview(node.getText(sourceFile));
  hits.push({
    file: relPath,
    line: pos.line + 1,
    column: pos.character + 1,
    kind,
    code,
    targetType,
  });
}

const TEXT_PREVIEW_MAX_LENGTH = 80;

function textPreview(s: string) {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length <= TEXT_PREVIEW_MAX_LENGTH
    ? one
    : one.slice(0, TEXT_PREVIEW_MAX_LENGTH - 1) + '…';
}

function countBindingPatternElements(
  pattern: ts.BindingPattern,
  sourceFile: ts.SourceFile,
  typeChecker: Checker,
  declarationTypes: Map<ts.Node, Type>,
  bumpFile: (typed: boolean) => void,
  anyHits: AnyHit[],
  parentKind: 'var(binding)' | 'param(binding)',
  parentDeclaration?: ts.VariableDeclaration | ts.ParameterDeclaration
): number {
  let count = 0;

  for (const element of pattern.elements) {
    // TS 7 parses an elision like `[, b]` as a binding element without a name.
    if (ts.isOmittedExpression(element) || !element.name) {
      continue;
    }

    count++;
    let typed = false;
    const nameText =
      element.name && ts.isIdentifier(element.name)
        ? element.name.getText(sourceFile)
        : '<pattern>';

    // Check inferred type
    const elementType = declarationTypes.get(element)!;
    if (!isAny(elementType, typeChecker)) {
      typed = true;
    } else if (element.dotDotDotToken) {
      // Rest spread element - check parent type
      const parentType = parentDeclaration
        ? declarationTypes.get(parentDeclaration)!
        : undefined;
      const isContextuallyTyped =
        parentDeclaration &&
        parentKind === 'param(binding)' &&
        ts.isParameterDeclaration(parentDeclaration) &&
        !hasExplicitType(parentDeclaration) &&
        isContextuallyTypedCallbackParam(parentDeclaration, typeChecker);

      if ((parentType && !isAny(parentType, typeChecker)) || isContextuallyTyped) {
        typed = true;
      }
    } else if (
      parentDeclaration &&
      parentKind === 'param(binding)' &&
      ts.isParameterDeclaration(parentDeclaration)
    ) {
      // Function parameter destructuring - check parent context
      const parentType = declarationTypes.get(parentDeclaration)!;
      const hasParentExplicitType = hasExplicitType(parentDeclaration);
      const isContextuallyTyped = isContextuallyTypedCallbackParam(
        parentDeclaration,
        typeChecker
      );

      if (
        (hasParentExplicitType && !isAny(parentType, typeChecker)) ||
        (!hasParentExplicitType && isContextuallyTyped)
      ) {
        typed = true;
      }
    }

    bumpFile(typed);
    if (!typed) {
      recordAny(anyHits, sourceFile, element, parentKind, nameText);
    }

    // Recurse for nested patterns
    if (
      ts.isArrayBindingPattern(element.name) ||
      ts.isObjectBindingPattern(element.name)
    ) {
      count += countBindingPatternElements(
        element.name,
        sourceFile,
        typeChecker,
        declarationTypes,
        bumpFile,
        anyHits,
        parentKind,
        parentDeclaration
      );
    }
  }

  return count;
}

function analyzeNode(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  typeChecker: Checker,
  declarationTypes: Map<ts.Node, Type>,
  opts: Options,
  bump: (typed: boolean) => void,
  anyHits: AnyHit[],
  nonNullHits: NonNullHit[],
  typeAssertionHits: TypeAssertionHit[]
) {
  // Variable declarations
  if (ts.isVariableDeclaration(node)) {
    if (ts.isArrayBindingPattern(node.name) || ts.isObjectBindingPattern(node.name)) {
      const relBump = (typed: boolean) => bump(typed);
      countBindingPatternElements(
        node.name,
        sourceFile,
        typeChecker,
        declarationTypes,
        relBump,
        anyHits,
        'var(binding)',
        node
      );
      return;
    }

    const nodeType = declarationTypes.get(node)!;
    const explicitTypeNode = node.type;
    const hasExplicitAny =
      explicitTypeNode && /\bany\b/.test(explicitTypeNode.getText(sourceFile));

    // Check if it's a styled component
    const isStyledComponent =
      node.initializer &&
      ts.isTaggedTemplateExpression(node.initializer) &&
      (/styled/i.test(node.initializer.tag.getText(sourceFile)) ||
        node.initializer.tag.getText(sourceFile).toLowerCase().includes('styled'));

    const typed = hasExplicitType(node)
      ? !hasExplicitAny
      : !isAny(nodeType, typeChecker) || isStyledComponent;

    bump(!!typed);
    if (!typed && opts.listAny) {
      const nameText = ts.isIdentifier(node.name)
        ? node.name.getText(sourceFile)
        : '<pattern>';
      recordAny(anyHits, sourceFile, node, 'var', nameText);
    }
  }

  // Parameter declarations
  else if (ts.isParameterDeclaration(node)) {
    if (ts.isArrayBindingPattern(node.name) || ts.isObjectBindingPattern(node.name)) {
      const relBump = (typed: boolean) => bump(typed);
      countBindingPatternElements(
        node.name,
        sourceFile,
        typeChecker,
        declarationTypes,
        relBump,
        anyHits,
        'param(binding)',
        node
      );

      // Also count the parameter itself
      let typedParam = false;
      if (hasExplicitType(node)) {
        const hasExplicitAny = node.type && /\bany\b/.test(node.type.getText(sourceFile));
        typedParam = !hasExplicitAny;
      } else {
        const paramType = declarationTypes.get(node)!;
        if (!isAny(paramType, typeChecker)) {
          typedParam = true;
        } else if (isContextuallyTypedCallbackParam(node, typeChecker)) {
          typedParam = true;
        }
      }

      bump(typedParam);
      if (!typedParam && opts.listAny) {
        let nameText = '<pattern>';
        if (ts.isIdentifier(node.name)) {
          nameText = (node.name as ts.Identifier).getText(sourceFile);
        }
        recordAny(anyHits, sourceFile, node, 'param', nameText);
      }
      return;
    }

    let typed = false;
    const hasExplicitAny = node.type && /\bany\b/.test(node.type.getText(sourceFile));

    if (hasExplicitType(node)) {
      typed = !hasExplicitAny;
    } else {
      const paramType = declarationTypes.get(node)!;
      if (!isAny(paramType, typeChecker)) {
        typed = true;
      } else if (isContextuallyTypedCallbackParam(node, typeChecker)) {
        typed = true;
      }
    }

    bump(typed);
    if (!typed && opts.listAny) {
      let nameText = '<pattern>';
      if (ts.isIdentifier(node.name)) {
        nameText = node.name.getText(sourceFile);
      }
      recordAny(anyHits, sourceFile, node, 'param', nameText);
    }
  }

  // Non-null assertions
  else if (ts.isNonNullExpression(node)) {
    if (opts.listNonNull) {
      recordNonNull(nonNullHits, sourceFile, node, 'nonnull(expr)');
      bump(false); // Count as untyped
    }
  }

  // Property declarations with definite assignment assertion
  else if (
    ts.isPropertyDeclaration(node) &&
    node.postfixToken?.kind === ts.SyntaxKind.ExclamationToken
  ) {
    if (opts.listNonNull) {
      recordNonNull(nonNullHits, sourceFile, node, 'nonnull(property)');
      bump(false); // Count as untyped
    }
  }

  // Type assertions (as expressions)
  else if (ts.isAsExpression(node)) {
    const targetType = node.type.getText(sourceFile);

    if (targetType === 'any') {
      const code = textPreview(node.getText(sourceFile));
      recordAny(anyHits, sourceFile, node, 'as-any', code);
      bump(false); // Always count as untyped
    } else if (targetType === 'const') {
      // Skip "as const" - not unsafe
    } else if (opts.listTypeAssertions) {
      recordTypeAssertion(typeAssertionHits, sourceFile, node, 'type(as)', targetType);
      bump(false); // Count as untyped when flag is enabled
    }
  }

  // Type assertions (angle bracket syntax)
  else if (ts.isTypeAssertion(node)) {
    const targetType = node.type.getText(sourceFile);

    if (targetType === 'any') {
      const code = textPreview(node.getText(sourceFile));
      recordAny(anyHits, sourceFile, node, 'as-any', code);
      bump(false); // Always count as untyped
    } else if (opts.listTypeAssertions) {
      recordTypeAssertion(typeAssertionHits, sourceFile, node, 'type(angle)', targetType);
      bump(false); // Count as untyped when flag is enabled
    }
  }

  // Recursively analyze child nodes
  node.forEachChild(child =>
    analyzeNode(
      child,
      sourceFile,
      typeChecker,
      declarationTypes,
      opts,
      bump,
      anyHits,
      nonNullHits,
      typeAssertionHits
    )
  );
}

function main() {
  const opts = parseArgs();
  const tsconfigPath = path.resolve(opts.tsconfigPath);

  if (!fs.existsSync(tsconfigPath)) {
    console.error(colors.red(`tsconfig.json not found at: ${tsconfigPath}`));
    process.exit(1);
  }

  // Keep all tsconfig files in the program so ignored files can still provide
  // declarations needed to infer types in files that we analyze.
  using api = new API({cwd: process.cwd()});
  using snapshot = api.createSnapshot({openProjects: [tsconfigPath]});
  const project = snapshot.getConfiguredProject(tsconfigPath);
  if (!project) {
    console.error(colors.red(`Could not load project: ${tsconfigPath}`));
    process.exit(1);
  }

  if (project.parsedCommandLine.errors.length > 0) {
    console.error(colors.red('Error parsing tsconfig:'));
    console.error(formatDiagnostics(project.parsedCommandLine.errors, api));
    process.exit(1);
  }

  let files = project.parsedCommandLine.fileNames.filter(filePath => {
    return !filePath.includes('node_modules');
  });

  if (opts.ignoreFiles) {
    const cwd = process.cwd();
    const ignoreFiles = opts.ignoreFiles;
    // Match against the tsconfig files instead of globbing the whole repo.
    files = files.filter(
      filePath =>
        !ignoreFiles.some(pattern =>
          path.matchesGlob(path.relative(cwd, filePath), pattern)
        )
    );
  }

  if (files.length === 0) {
    console.error(colors.yellow('No files found in tsconfig include/exclude settings.'));
    process.exit(2);
  }

  const typeChecker = project.checker;

  const totals = {total: 0, typed: 0};
  const perFile: Record<string, {total: number; typed: number}> = {};
  const anyHits: AnyHit[] = [];
  const nonNullHits: NonNullHit[] = [];
  const typeAssertionHits: TypeAssertionHit[] = [];

  function bump(file: string, typed: boolean) {
    const rec = (perFile[file] ||= {total: 0, typed: 0});
    rec.total++;
    if (typed) {
      rec.typed++;
    }
    totals.total++;
    if (typed) {
      totals.typed++;
    }
  }

  // Analyze each source file. `files` only controls which files contribute to
  // the coverage numbers below.
  for (const fileName of files) {
    const sourceFile = project.program.getSourceFile(fileName);
    if (!sourceFile) {
      continue;
    }

    const relPath = path.relative(process.cwd(), sourceFile.fileName);
    const fileBump = (typed: boolean) => bump(relPath, typed);

    analyzeNode(
      sourceFile,
      sourceFile,
      typeChecker,
      getDeclarationTypes(sourceFile, typeChecker),
      opts,
      fileBump,
      anyHits,
      nonNullHits,
      typeAssertionHits
    );
  }

  const pct = totals.total ? (totals.typed / totals.total) * 100 : 100;

  // Output results (same as before)
  if (opts.json) {
    const data: any = {
      summary: {
        total: totals.total,
        typed: totals.typed,
        untyped: totals.total - totals.typed,
        coverage: Number(pct.toFixed(2)),
        filesScanned: files.length,
      },
      files: Object.entries(perFile).map(([f, c]) => ({
        file: f,
        total: c.total,
        typed: c.typed,
        coverage: Number(((c.typed / c.total) * 100).toFixed(2)),
      })),
    };
    if (opts.listAny) {
      data.anySymbols = anyHits;
    }
    if (opts.listNonNull) {
      data.nonNullAssertions = nonNullHits;
    }
    if (opts.listTypeAssertions) {
      data.typeAssertions = typeAssertionHits;
    }
    console.log(JSON.stringify(data, null, 2));
  } else if (opts.listAny || opts.listNonNull || opts.listTypeAssertions) {
    if (opts.listAny) {
      if (anyHits.length === 0) {
        console.log(colors.green('No any-typed symbols found.'));
      } else {
        console.log(colors.bold(`Found ${anyHits.length} any-typed symbol(s)`));
        if (opts.detail) {
          console.log();
          // Sort hits by file path first, then by line number
          const sortedHits = anyHits.sort((a, b) => {
            if (a.file !== b.file) {
              return a.file.localeCompare(b.file);
            }
            return a.line - b.line;
          });
          for (const hit of sortedHits) {
            console.log(
              `${hit.file}:${hit.line}:${hit.column}  ${colors.red(hit.kind.padEnd(13))}  ${colors.dim(hit.name)}`
            );
          }
          console.log();
        }
      }
    }

    if (opts.listNonNull) {
      if (nonNullHits.length === 0) {
        console.log(colors.green('No non-null assertions found.'));
      } else {
        console.log(colors.bold(`Found ${nonNullHits.length} non-null assertion(s)`));
        if (opts.detail) {
          console.log();
          // Sort hits by file path first, then by line number
          const sortedHits = nonNullHits.sort((a, b) => {
            if (a.file !== b.file) {
              return a.file.localeCompare(b.file);
            }
            return a.line - b.line;
          });
          for (const hit of sortedHits) {
            console.log(
              `${hit.file}:${hit.line}:${hit.column}  ${colors.yellow(hit.kind.padEnd(16))}  ${colors.dim(hit.code)}`
            );
          }
          console.log();
        }
      }
    }

    if (opts.listTypeAssertions) {
      if (typeAssertionHits.length === 0) {
        console.log(colors.green('No type assertions found.'));
      } else {
        console.log(colors.bold(`Found ${typeAssertionHits.length} type assertion(s)`));
        if (opts.detail) {
          console.log();
          // Sort hits by file path first, then by line number
          const sortedHits = typeAssertionHits.sort((a, b) => {
            if (a.file !== b.file) {
              return a.file.localeCompare(b.file);
            }
            return a.line - b.line;
          });
          for (const hit of sortedHits) {
            console.log(
              `${hit.file}:${hit.line}:${hit.column}  ${colors.cyan(hit.kind.padEnd(12))}  ${colors.magenta(hit.targetType.padEnd(20))}  ${colors.dim(hit.code)}`
            );
          }
          console.log();
        }
      }
    }

    console.log(colors.bold('Summary'));
    console.log(`Files scanned: ${files.length}`);
    console.log(`Items total  : ${totals.total}`);
    console.log(`Items typed  : ${totals.typed}`);
    console.log(`Items untyped: ${totals.total - totals.typed}`);
    console.log(`Coverage     : ${colors.green(pct.toFixed(2) + '%')}\n`);
  } else {
    console.log(colors.bold('\nType Coverage Report (tsconfig-aware)'));
    console.log(`Files scanned: ${files.length}`);
    console.log(`Items total  : ${totals.total}`);
    console.log(`Items typed  : ${totals.typed}`);
    console.log(`Items untyped: ${totals.total - totals.typed}`);
    console.log(`Coverage     : ${colors.green(pct.toFixed(2) + '%')}\n`);

    const worst = Object.entries(perFile)
      .map(([file, c]) => ({file, pct: c.total ? (c.typed / c.total) * 100 : 100}))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 10);

    if (worst.length) {
      console.log(colors.bold('Lowest coverage files:'));
      for (const w of worst) {
        console.log(`  ${colors.dim(w.file)}  ${w.pct.toFixed(2)}%`);
      }
      console.log();
    }
  }

  if (opts.failBelow && pct < opts.failBelow) {
    console.error(
      colors.red(`Coverage ${pct.toFixed(2)}% is below threshold ${opts.failBelow}%`)
    );
    process.exit(1);
  }
}

try {
  main();
} catch (err) {
  console.error(colors.red(String(err)));
  process.exit(1);
}
