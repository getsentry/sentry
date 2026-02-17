#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';

import * as ts from 'typescript';

// Terminal color codes
const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  magenta: (text: string) => `\x1b[35m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
  dim: (text: string) => `\x1b[2m${text}\x1b[0m`,
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
    if (a === '--fail-below') opts.failBelow = Number(args[++i]);
    else if (a === '--json') opts.json = true;
    else if (a === '--project' || a === '-p') opts.tsconfigPath = args[++i]!;
    else if (a === '--list-any') opts.listAny = true;
    else if (a === '--list-nonnull') opts.listNonNull = true;
    else if (a === '--list-type-assertions') opts.listTypeAssertions = true;
    else if (a === '--detail') opts.detail = true;
    else if (a === '--ignore-files') {
      if (!opts.ignoreFiles) opts.ignoreFiles = [];
      opts.ignoreFiles.push(args[++i]!);
    }
  }
  return opts;
}

const isAny = (type: ts.Type, typeChecker: ts.TypeChecker) => {
  if (type.flags & ts.TypeFlags.Any) return true;
  const typeText = typeChecker.typeToString(type);
  if (typeText === 'any') return true;
  // Check for 'any' within generic types like Record<string, any>, Array<any>, etc.
  return /\bany\b/.test(typeText);
};

function hasExplicitType(
  node: ts.VariableDeclaration | ts.ParameterDeclaration
): boolean {
  return !!node.type;
}

function isContextuallyTypedCallbackParam(
  param: ts.ParameterDeclaration,
  typeChecker: ts.TypeChecker
): boolean {
  const parent = param.parent;
  if (!ts.isFunctionExpression(parent) && !ts.isArrowFunction(parent)) return false;

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
  if (!contextualType) return false;

  const signatures = typeChecker.getSignaturesOfType(
    contextualType,
    ts.SignatureKind.Call
  );
  if (signatures.length === 0) return false;

  const sig = signatures[0]!;
  const paramIndex = parent.parameters.indexOf(param);
  if (paramIndex < 0 || paramIndex >= sig.parameters.length) return false;

  const paramType = typeChecker.getTypeOfSymbolAtLocation(
    sig.parameters[paramIndex]!,
    param
  );
  return !isAny(paramType, typeChecker);
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
  const pos = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
  const relPath = path.relative(process.cwd(), sourceFile.fileName);

  hits.push({
    file: relPath,
    line: pos.line + 1,
    column: pos.character + 1,
    kind,
    name,
  });
}

function recordNonNull(
  hits: NonNullHit[],
  sourceFile: ts.SourceFile,
  node: ts.Node,
  kind: NonNullHit['kind'],
  codeNode?: ts.Node
) {
  const pos = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
  const relPath = path.relative(process.cwd(), sourceFile.fileName);
  const code = textPreview((codeNode ?? node).getText(sourceFile));
  hits.push({
    file: relPath,
    line: pos.line + 1,
    column: pos.character + 1,
    kind,
    code,
  });
}

function recordTypeAssertion(
  hits: TypeAssertionHit[],
  sourceFile: ts.SourceFile,
  node: ts.Node,
  kind: TypeAssertionHit['kind'],
  targetType: string,
  codeNode?: ts.Node
) {
  const pos = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
  const relPath = path.relative(process.cwd(), sourceFile.fileName);
  const code = textPreview((codeNode ?? node).getText(sourceFile));
  hits.push({
    file: relPath,
    line: pos.line + 1,
    column: pos.character + 1,
    kind,
    code,
    targetType,
  });
}

function textPreview(s: string, max = 80) {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length <= max ? one : one.slice(0, max - 1) + '…';
}

function countBindingPatternElements(
  pattern: ts.BindingPattern,
  sourceFile: ts.SourceFile,
  typeChecker: ts.TypeChecker,
  bumpFile: (typed: boolean) => void,
  anyHits: AnyHit[],
  parentKind: 'var(binding)' | 'param(binding)',
  parentDeclaration?: ts.VariableDeclaration | ts.ParameterDeclaration
): number {
  let count = 0;

  for (const element of pattern.elements) {
    if (ts.isOmittedExpression(element)) continue;

    count++;
    let typed = false;
    const nameText =
      element.name && ts.isIdentifier(element.name)
        ? element.name.getText(sourceFile)
        : '<pattern>';

    // Check inferred type
    const elementType = typeChecker.getTypeAtLocation(element);
    if (!isAny(elementType, typeChecker)) {
      typed = true;
    } else if (element.dotDotDotToken) {
      // Rest spread element - check parent type
      const parentType = parentDeclaration
        ? typeChecker.getTypeAtLocation(parentDeclaration)
        : undefined;
      if (parentType && !isAny(parentType, typeChecker)) {
        typed = true;
      }
    } else if (
      parentDeclaration &&
      parentKind === 'param(binding)' &&
      ts.isParameter(parentDeclaration)
    ) {
      // Function parameter destructuring - check parent context
      const parentType = typeChecker.getTypeAtLocation(parentDeclaration);
      const hasParentExplicitType = hasExplicitType(parentDeclaration);
      const isContextuallyTyped = isContextuallyTypedCallbackParam(
        parentDeclaration,
        typeChecker
      );

      if (
        (hasParentExplicitType || isContextuallyTyped) &&
        !isAny(parentType, typeChecker)
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
  typeChecker: ts.TypeChecker,
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
        relBump,
        anyHits,
        'var(binding)',
        node
      );
      return;
    }

    const nodeType = typeChecker.getTypeAtLocation(node);
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
  else if (ts.isParameter(node)) {
    if (ts.isArrayBindingPattern(node.name) || ts.isObjectBindingPattern(node.name)) {
      const relBump = (typed: boolean) => bump(typed);
      countBindingPatternElements(
        node.name,
        sourceFile,
        typeChecker,
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
        const paramType = typeChecker.getTypeAtLocation(node);
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
      const paramType = typeChecker.getTypeAtLocation(node);
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
  else if (ts.isPropertyDeclaration(node) && node.exclamationToken) {
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
  else if (ts.isTypeAssertionExpression(node)) {
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
  ts.forEachChild(node, child =>
    analyzeNode(
      child,
      sourceFile,
      typeChecker,
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

  // Read and parse tsconfig
  const configFile = ts.readConfigFile(tsconfigPath, filename => {
    try {
      return fs.readFileSync(filename, 'utf8');
    } catch {
      return undefined;
    }
  });

  if (configFile.error) {
    console.error(
      colors.red('Error reading tsconfig:'),
      ts.formatDiagnostic(configFile.error, {
        getCurrentDirectory: () => process.cwd(),
        getCanonicalFileName: fileName => fileName,
        getNewLine: () => ts.sys.newLine,
      })
    );
    process.exit(1);
  }

  const host: ts.ParseConfigHost = {
    fileExists: fs.existsSync,
    readDirectory: ts.sys.readDirectory,
    readFile: filename => {
      try {
        return fs.readFileSync(filename, 'utf8');
      } catch {
        return undefined;
      }
    },
    useCaseSensitiveFileNames: true,
  };

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    host,
    path.dirname(tsconfigPath)
  );

  if (parsedConfig.errors.length > 0) {
    console.error(colors.red('Error parsing tsconfig:'));
    for (const error of parsedConfig.errors) {
      console.error(
        ts.formatDiagnostic(error, {
          getCurrentDirectory: () => process.cwd(),
          getCanonicalFileName: fileName => fileName,
          getNewLine: () => ts.sys.newLine,
        })
      );
    }
    process.exit(1);
  }

  // Filter files
  let files = parsedConfig.fileNames.filter(filePath => {
    return !filePath.includes('node_modules');
  });

  if (opts.ignoreFiles) {
    const cwd = process.cwd();
    const ignoreSet = new Set<string>();

    for (const pattern of opts.ignoreFiles) {
      try {
        const matches = fs.globSync(pattern, {cwd});
        for (const match of matches) {
          ignoreSet.add(path.resolve(cwd, match));
        }
      } catch {
        // Pattern might be invalid, skip it
      }
    }

    files = files.filter(filePath => !ignoreSet.has(filePath));
  }

  if (files.length === 0) {
    console.error(colors.yellow('No files found in tsconfig include/exclude settings.'));
    process.exit(2);
  }

  // Create program
  const program = ts.createProgram(files, parsedConfig.options);
  const typeChecker = program.getTypeChecker();

  const totals = {total: 0, typed: 0};
  const perFile: Record<string, {total: number; typed: number}> = {};
  const anyHits: AnyHit[] = [];
  const nonNullHits: NonNullHit[] = [];
  const typeAssertionHits: TypeAssertionHit[] = [];

  function bump(file: string, typed: boolean) {
    const rec = (perFile[file] ||= {total: 0, typed: 0});
    rec.total++;
    if (typed) rec.typed++;
    totals.total++;
    if (typed) totals.typed++;
  }

  // Analyze each source file
  for (const sourceFile of program.getSourceFiles()) {
    if (!files.includes(sourceFile.fileName)) continue;

    const relPath = path.relative(process.cwd(), sourceFile.fileName);
    const fileBump = (typed: boolean) => bump(relPath, typed);

    analyzeNode(
      sourceFile,
      sourceFile,
      typeChecker,
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
    if (opts.listAny) data.anySymbols = anyHits;
    if (opts.listNonNull) data.nonNullAssertions = nonNullHits;
    if (opts.listTypeAssertions) data.typeAssertions = typeAssertionHits;
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
            if (a.file !== b.file) return a.file.localeCompare(b.file);
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
            if (a.file !== b.file) return a.file.localeCompare(b.file);
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
            if (a.file !== b.file) return a.file.localeCompare(b.file);
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
      .map(([file, c]) => ({
        file,
        pct: c.total ? (c.typed / c.total) * 100 : 100,
      }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 10);

    if (worst.length) {
      console.log(colors.bold('Lowest coverage files:'));
      for (const w of worst) console.log(`  ${colors.dim(w.file)}  ${w.pct.toFixed(2)}%`);
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
