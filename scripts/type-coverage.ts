#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';

import {minimatch} from 'minimatch';
import pc from 'picocolors';
import {
  ArrowFunction,
  FunctionExpression,
  Node,
  ParameterDeclaration,
  Project,
  Type,
} from 'ts-morph';

type Options = {
  tsconfigPath: string;
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
    else if (a === '--list-nonnull')
      opts.listNonNull = true; // NEW
    else if (a === '--list-type-assertions') opts.listTypeAssertions = true;
    else if (a === '--ignore-files') {
      if (!opts.ignoreFiles) opts.ignoreFiles = [];
      opts.ignoreFiles.push(args[++i]!);
    }
  }
  return opts;
}

const isAny = (t: Type) => t.isAny() || t.getText() === 'any';

function hasExplicitType(node: {getTypeNode?: () => any}): boolean {
  try {
    return !!node.getTypeNode?.();
  } catch {
    return false;
  }
}

function isFunctionExpressionLike(fn: Node): fn is ArrowFunction | FunctionExpression {
  return Node.isArrowFunction(fn) || Node.isFunctionExpression(fn);
}

function isAnyFunctionLike(n: Node) {
  return (
    Node.isFunctionDeclaration(n) ||
    Node.isMethodDeclaration(n) ||
    Node.isArrowFunction(n) ||
    Node.isFunctionExpression(n)
  );
}

function paramIndex(param: ParameterDeclaration) {
  const parent = param.getParent();
  if (!parent || !isAnyFunctionLike(parent)) return -1;
  return parent.getParameters().indexOf(param);
}

function isContextuallyTypedCallbackParam(param: ParameterDeclaration): boolean {
  const parent = param.getParent();
  if (!parent || !isFunctionExpressionLike(parent)) return false;

  // Only expressions (arrow/function expressions) have contextual type
  const ctxt = parent.getContextualType();
  if (!ctxt) return false;
  const sig = ctxt.getCallSignatures()[0];
  if (!sig) return false;

  const idx = paramIndex(param);
  if (idx < 0) return false;

  const sigParams = sig.getParameters();
  if (idx >= sigParams.length) return false;

  const paramType = sigParams[idx]!.getValueDeclarationOrThrow().getType();
  return !isAny(paramType);
}

type AnyHit = {
  column: number;
  file: string;
  kind: 'var' | 'var(binding)' | 'param' | 'param(binding)' | 'as-any';
  // 1-based numbers below
  line: number;
  name: string;
};

type NonNullHit = {
  code: string;
  column: number;
  file: string;
  kind: 'nonnull(expr)' | 'nonnull(property)';
  // 1-based
  line: number; // short preview
};

type TypeAssertionHit = {
  code: string;
  column: number;
  file: string;
  kind: 'type(as)' | 'type(angle)';
  // 1-based
  line: number;
  targetType: string;
};

// record helpers
function recordAny(
  hits: AnyHit[],
  sfRelPath: string,
  node: Node,
  kind: AnyHit['kind'],
  name: string
) {
  const sf = node.getSourceFile();
  const pos = (node as any).getNameNode?.()?.getStart?.() ?? node.getStart();
  const {line, column} = sf.getLineAndColumnAtPos(pos);
  hits.push({file: sfRelPath, line, column, kind, name});
}

function textPreview(s: string, max = 80) {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length <= max ? one : one.slice(0, max - 1) + '…';
}

function recordNonNull(
  hits: NonNullHit[],
  sfRelPath: string,
  node: Node,
  kind: NonNullHit['kind'],
  codeNode?: Node
) {
  const sf = node.getSourceFile();
  const pos = node.getStart();
  const {line, column} = sf.getLineAndColumnAtPos(pos);
  const code = textPreview((codeNode ?? node).getText());
  hits.push({file: sfRelPath, line, column, kind, code});
}

function recordTypeAssertion(
  hits: TypeAssertionHit[],
  sfRelPath: string,
  node: Node,
  kind: TypeAssertionHit['kind'],
  targetType: string,
  codeNode?: Node
) {
  const sf = node.getSourceFile();
  const pos = node.getStart();
  const {line, column} = sf.getLineAndColumnAtPos(pos);
  const code = textPreview((codeNode ?? node).getText());
  hits.push({file: sfRelPath, line, column, kind, code, targetType});
}

/**
 * Count elements inside an object/array binding pattern, bumping coverage and recording "any" hits.
 * Returns true if it handled a binding pattern (caller shouldn't double-count parent).
 */
function countBindingPatternElements(
  nameNode: any,
  relPath: string,
  bumpFile: (typed: boolean) => void,
  anyHits: AnyHit[],
  parentKind: 'var(binding)' | 'param(binding)'
) {
  if (Node.isIdentifier(nameNode)) {
    // single identifier case — let caller handle it
    return false;
  }

  if (Node.isObjectBindingPattern(nameNode) || Node.isArrayBindingPattern(nameNode)) {
    for (const el of nameNode.getElements()) {
      // Skip holes in array patterns
      if ((Node as any).isOmittedExpression?.(el)) continue;

      // Identifier or nested pattern
      const nameNodeInner = (el as any).getNameNode?.() ?? (el as any).getName?.();
      if (!nameNodeInner) continue;

      const nameText = nameNodeInner.getText?.() ?? '<pattern>';

      // If there’s an explicit type on the binding element (rare), that counts
      const explicit = (el as any).getTypeNode?.();
      let typed = !!explicit;

      if (!typed) {
        const t = (el as any).getType?.();
        if (t && !isAny(t)) typed = true;
      }

      bumpFile(typed);
      if (!typed) {
        recordAny(anyHits, relPath, nameNodeInner, parentKind, nameText);
      }

      // Recurse into nested patterns like { a: { b } }
      if (
        Node.isObjectBindingPattern(nameNodeInner) ||
        Node.isArrayBindingPattern(nameNodeInner)
      ) {
        countBindingPatternElements(
          nameNodeInner,
          relPath,
          bumpFile,
          anyHits,
          parentKind
        );
      }
    }
    return true;
  }

  return false;
}

function main() {
  const opts = parseArgs();
  const tsconfigPath = path.resolve(opts.tsconfigPath);
  if (!fs.existsSync(tsconfigPath)) {
    console.error(pc.red(`tsconfig.json not found at: ${tsconfigPath}`));
    process.exit(1);
  }

  const project = new Project({
    tsConfigFilePath: tsconfigPath,
    skipAddingFilesFromTsConfig: false,
  });

  const files = project.getSourceFiles().filter(sf => {
    const filePath = sf.getFilePath();
    if (filePath.includes('node_modules')) return false;

    // Check ignore patterns
    if (opts.ignoreFiles) {
      const relPath = path.relative(process.cwd(), filePath);
      for (const pattern of opts.ignoreFiles) {
        if (minimatch(relPath, pattern)) {
          return false;
        }
      }
    }

    return true;
  });

  if (files.length === 0) {
    console.error(pc.yellow('No files found in tsconfig include/exclude settings.'));
    process.exit(2);
  }

  const totals = {total: 0, typed: 0};
  const perFile: Record<string, {total: number; typed: number}> = {};
  const anyHits: AnyHit[] = []; // for --list-any
  const nonNullHits: NonNullHit[] = []; // for --list-nonnull
  const typeAssertionHits: TypeAssertionHit[] = []; // for --list-type-assertions

  function bump(file: string, typed: boolean) {
    const rec = (perFile[file] ||= {total: 0, typed: 0});
    rec.total++;
    if (typed) rec.typed++;
    totals.total++;
    if (typed) totals.typed++;
  }

  for (const sf of files) {
    const rel = path.relative(process.cwd(), sf.getFilePath());

    sf.forEachDescendant(node => {
      // --- Variables ---
      if (Node.isVariableDeclaration(node)) {
        const v = node;
        const relBump = (typed: boolean) => bump(rel, typed);

        const nameNode = (v as any).getNameNode?.();
        if (
          nameNode &&
          countBindingPatternElements(nameNode, rel, relBump, anyHits, 'var(binding)')
        ) {
          return;
        }

        const t = v.getType();
        const typed = hasExplicitType(v) || !isAny(t);
        bump(rel, typed);
        if (!typed && opts.listAny) {
          const nameText = (v as any).getName?.() ?? nameNode?.getText?.() ?? '<pattern>';
          recordAny(anyHits, rel, v, 'var', String(nameText));
        }
        return;
      }

      // --- Parameters ---
      if (Node.isParameterDeclaration(node)) {
        const param = node;
        const relBump = (typed: boolean) => bump(rel, typed);

        const nameNode = (param as any).getNameNode?.();
        if (
          nameNode &&
          countBindingPatternElements(nameNode, rel, relBump, anyHits, 'param(binding)')
        ) {
          // Also count the parameter itself once (represents the whole tuple/object)
          let typedParam = false;
          if (hasExplicitType(param)) typedParam = true;
          else {
            const t = param.getType();
            if (!isAny(t)) typedParam = true;
            else if (isContextuallyTypedCallbackParam(param)) typedParam = true;
          }
          bump(rel, typedParam);
          if (!typedParam && opts.listAny) {
            const nameText =
              (param as any).getName?.() ?? nameNode?.getText?.() ?? '<pattern>';
            recordAny(anyHits, rel, param, 'param', String(nameText));
          }
          return;
        }

        let typed = false;
        if (hasExplicitType(param)) {
          typed = true;
        } else {
          const t = param.getType();
          if (!isAny(t)) typed = true;
          else if (isContextuallyTypedCallbackParam(param)) typed = true;
        }
        bump(rel, typed);
        if (!typed && opts.listAny) {
          const nameText =
            (param as any).getName?.() ?? nameNode?.getText?.() ?? '<param>';
          recordAny(anyHits, rel, param, 'param', String(nameText));
        }
        return;
      }

      // --- Non-null assertions (expr!) ---
      if (opts.listNonNull && Node.isNonNullExpression?.(node)) {
        // NonNullExpression wraps the inner expression; show the whole 'expr!' text
        recordNonNull(nonNullHits, rel, node, 'nonnull(expr)');
        return;
      }

      // --- Definite assignment assertions on class fields: prop!: T ---
      if (opts.listNonNull && Node.isPropertyDeclaration(node)) {
        const pd = node;
        // hasExclamationToken() exists on PropertyDeclaration in ts-morph
        if ((pd as any).hasExclamationToken?.()) {
          // Use the identifier name as preview if available
          const nameNode =
            ((pd as any).getNameNode?.() ?? pd.getName()) ? (pd as any) : undefined;
          recordNonNull(nonNullHits, rel, node, 'nonnull(property)', nameNode ?? node);
        }
        return;
      }

      // --- Type assertions (expr as Type) ---
      if (Node.isAsExpression?.(node)) {
        const targetType = (node as any).getTypeNode?.()?.getText() ?? 'unknown';

        // Handle "as any" - treat it as an any-typed symbol, always report
        if (targetType === 'any') {
          const code = textPreview(node.getText());
          recordAny(anyHits, rel, node, 'as-any', code);
          return;
        }

        // Skip "as const" assertions since they're for literal type narrowing, not unsafe coercion
        if (targetType === 'const') {
          return;
        }

        // Only record other type assertions if the flag is set
        if (opts.listTypeAssertions) {
          recordTypeAssertion(typeAssertionHits, rel, node, 'type(as)', targetType);
        }
        return;
      }

      // --- Type assertions (<Type>expr - angle bracket syntax) ---
      if (Node.isTypeAssertion?.(node)) {
        const targetType = (node as any).getTypeNode?.()?.getText() ?? 'unknown';

        // Handle "<any>expr" - treat it as an any-typed symbol, always report
        if (targetType === 'any') {
          const code = textPreview(node.getText());
          recordAny(anyHits, rel, node, 'as-any', code);
          return;
        }

        // Only record other type assertions if the flag is set
        if (opts.listTypeAssertions) {
          recordTypeAssertion(typeAssertionHits, rel, node, 'type(angle)', targetType);
        }
        return;
      }
    });
  }

  const pct = totals.total ? (totals.typed / totals.total) * 100 : 100;

  // Output
  if (opts.json) {
    const data: any = {
      summary: {
        total: totals.total,
        typed: totals.typed,
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
        console.log(pc.green('No any-typed symbols found.'));
      } else {
        console.log(pc.bold(`\nFound ${anyHits.length} any-typed symbol(s):\n`));
        for (const hit of anyHits) {
          console.log(
            `${hit.file}:${hit.line}:${hit.column}  ${pc.red(hit.kind.padEnd(13))}  ${pc.dim(hit.name)}`
          );
        }
        console.log();
      }
    }

    if (opts.listNonNull) {
      if (nonNullHits.length === 0) {
        console.log(pc.green('No non-null assertions found.'));
      } else {
        console.log(pc.bold(`\nFound ${nonNullHits.length} non-null assertion(s):\n`));
        for (const hit of nonNullHits) {
          // file:line:col  kind            code
          console.log(
            `${hit.file}:${hit.line}:${hit.column}  ${pc.yellow(hit.kind.padEnd(16))}  ${pc.dim(hit.code)}`
          );
        }
        console.log();
      }
    }

    if (opts.listTypeAssertions) {
      if (typeAssertionHits.length === 0) {
        console.log(pc.green('No type assertions found.'));
      } else {
        console.log(pc.bold(`\nFound ${typeAssertionHits.length} type assertion(s):\n`));
        for (const hit of typeAssertionHits) {
          // file:line:col  kind            target type    code
          console.log(
            `${hit.file}:${hit.line}:${hit.column}  ${pc.cyan(hit.kind.padEnd(12))}  ${pc.magenta(hit.targetType.padEnd(20))}  ${pc.dim(hit.code)}`
          );
        }
        console.log();
      }
    }

    // Quick summary
    console.log(pc.bold('Summary'));
    console.log(`Files scanned: ${files.length}`);
    console.log(`Items total : ${totals.total}`);
    console.log(`Items typed : ${totals.typed}`);
    console.log(`Coverage    : ${pc.green(pct.toFixed(2) + '%')}\n`);
  } else {
    // Original summary
    console.log(pc.bold('\nType Coverage Report (tsconfig-aware)'));
    console.log(`Files scanned: ${files.length}`);
    console.log(`Items total : ${totals.total}`);
    console.log(`Items typed : ${totals.typed}`);
    console.log(`Coverage    : ${pc.green(pct.toFixed(2) + '%')}\n`);

    const worst = Object.entries(perFile)
      .map(([file, c]) => ({
        file,
        pct: c.total ? (c.typed / c.total) * 100 : 100,
      }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 10);

    if (worst.length) {
      console.log(pc.bold('Lowest coverage files:'));
      for (const w of worst) console.log(`  ${pc.dim(w.file)}  ${w.pct.toFixed(2)}%`);
      console.log();
    }
  }

  if (opts.failBelow && pct < opts.failBelow) {
    console.error(
      pc.red(`Coverage ${pct.toFixed(2)}% is below threshold ${opts.failBelow}%`)
    );
    process.exit(1);
  }
}

try {
  main();
} catch (err) {
  console.error(pc.red(String(err)));
  process.exit(1);
}
