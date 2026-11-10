/**
 * Preview with node scripts/migrateTypedTabs.ts [paths...].
 * Use --write to update files, --out DIR to save previews, or --root DIR to select a checkout.
 * Review skipped files and format the changed files after this script runs.
 */

import cp from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

import {createProcessor} from '@mdx-js/mdx';
import ts from 'typescript';

type Edit = {end: number; start: number; text: string};
type Result = {
  notes: string[];
  source: string;
  status: 'changed' | 'unchanged' | 'skipped';
};
type Binding = {exported: string};

const tabsModule = '@sentry/scraps/tabs';
const layoutModule = '@sentry/scraps/layout';
const rootExports = new Set(['Tabs', 'TabStateProvider']);
const childExports = new Set(['TabList', 'TabPanels']);

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, child => walk(child, visit));
}

function applyEdits(source: string, edits: Edit[]): string {
  let previousStart = source.length + 1;
  for (const edit of edits.sort((a, b) => b.start - a.start || b.end - a.end)) {
    if (edit.end > previousStart) {
      throw new Error('Overlapping source edits');
    }
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
    previousStart = edit.start;
  }
  return source;
}

function isCallbackRoot(node: ts.JsxElement): boolean {
  const children = node.children.filter(
    child => !ts.isJsxText(child) || child.text.trim()
  );
  const child = children[0];
  return (
    children.length === 1 &&
    !!child &&
    ts.isJsxExpression(child) &&
    !!child.expression &&
    (ts.isArrowFunction(child.expression) || ts.isFunctionExpression(child.expression))
  );
}

function isImportIdentifier(node: ts.Node): boolean {
  return ts.isImportSpecifier(node.parent) || ts.isImportClause(node.parent);
}

function isInside(node: ts.Node, container: ts.Node): boolean {
  return node.getStart() >= container.getStart() && node.end <= container.end;
}

function parse(source: string, filename: string): ts.SourceFile {
  return ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
}

function maskedSource(source: string, filename: string): string {
  if (!filename.endsWith('.mdx')) {
    return source;
  }
  const tree = createProcessor().parse(source);
  const ranges: Array<[number, number]> = [];
  for (const node of tree.children) {
    const startOffset = node.position?.start.offset;
    const endOffset = node.position?.end.offset;
    if (startOffset === undefined || endOffset === undefined) {
      continue;
    }
    if (['mdxjsEsm', 'mdxJsxFlowElement', 'mdxFlowExpression'].includes(node.type)) {
      ranges.push([startOffset, endOffset]);
    } else if (
      node.type === 'code' &&
      node.lang &&
      ['jsx', 'tsx', 'js', 'ts'].includes(node.lang)
    ) {
      const start = source.indexOf('\n', startOffset) + 1;
      const end = source.lastIndexOf('\n', endOffset - 1);
      ranges.push([start, end]);
    }
  }
  const masked: string[] = source
    .split('')
    .map(character => (character === '\n' ? '\n' : ' '));
  for (const [start, end] of ranges) {
    for (let index = start; index < end; index++) {
      masked[index] = source.charAt(index);
    }
    let separator = start - 1;
    while (separator >= 0 && masked[separator] === '\n') {
      separator--;
    }
    if (separator >= 0 && masked[separator] === ' ') {
      masked[separator] = ';';
    }
  }
  return masked.join('');
}

export function transform(source: string, filename = 'input.tsx'): Result {
  const masked = maskedSource(source, filename);
  const sourceFile = parse(masked, filename);
  const imports = sourceFile.statements.filter(ts.isImportDeclaration);
  const tabsImports = imports.filter(
    node =>
      ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === tabsModule
  );
  if (!tabsImports.length) {
    return {source, status: 'unchanged', notes: []};
  }
  const bindings = new Map<string, Binding>();
  for (const declaration of tabsImports) {
    const named = declaration.importClause?.namedBindings;
    if (declaration.importClause?.name || !named || !ts.isNamedImports(named)) {
      return {source, status: 'skipped', notes: ['Tabs namespace or default import']};
    }
    for (const specifier of named.elements) {
      bindings.set(specifier.name.text, {
        exported: (specifier.propertyName ?? specifier.name).text,
      });
    }
  }
  const roots: ts.JsxElement[] = [];
  walk(sourceFile, node => {
    if (
      ts.isJsxElement(node) &&
      rootExports.has(
        bindings.get(node.openingElement.tagName.getText(sourceFile))?.exported ?? ''
      )
    ) {
      roots.push(node);
    }
  });
  const pending = roots.filter(root => !isCallbackRoot(root));
  if (!pending.length) {
    return {
      source,
      status: 'unchanged',
      notes: roots.length
        ? []
        : ['No direct root. Check styled roots or shared tab children.'],
    };
  }
  const notes: string[] = [];
  walk(sourceFile, node => {
    if (!ts.isIdentifier(node) || isImportIdentifier(node)) {
      return;
    }
    const binding = bindings.get(node.text);
    if (
      !binding ||
      (!rootExports.has(binding.exported) && !childExports.has(binding.exported))
    ) {
      return;
    }
    if (!roots.some(root => isInside(node, root))) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      notes.push(`${node.text} has an external use on line ${line}`);
    }
  });
  if (notes.length && !filename.endsWith('.mdx')) {
    return {source, status: 'skipped', notes};
  }
  for (const root of pending) {
    if (root.openingElement.attributes.properties.some(ts.isJsxSpreadAttribute)) {
      notes.push('Root has spread props. Check className and orientation.');
    }
    const orientation = root.openingElement.attributes.properties.find(
      attribute =>
        ts.isJsxAttribute(attribute) &&
        attribute.name.getText(sourceFile) === 'orientation'
    );
    if (
      orientation &&
      ts.isJsxAttribute(orientation) &&
      (!orientation.initializer || !ts.isStringLiteral(orientation.initializer))
    ) {
      notes.push('Root orientation is dynamic.');
    }
  }
  if (notes.some(note => /Root (has|orientation)/.test(note))) {
    return {source, status: 'skipped', notes};
  }
  const identifiers = new Set<string>();
  walk(sourceFile, node => {
    if (ts.isIdentifier(node)) {
      identifiers.add(node.text);
    }
  });
  function availableName(preferred: string, fallback: string): string {
    if (!identifiers.has(preferred)) {
      return preferred;
    }
    let candidate = fallback;
    let suffix = 2;
    while (identifiers.has(candidate)) {
      candidate = `${fallback}${suffix++}`;
    }
    return candidate;
  }
  const existingTabs = [...bindings].find(
    ([, binding]) => binding.exported === 'Tabs'
  )?.[0];
  const tabsName =
    existingTabs ??
    (bindings.get('Tabs')?.exported === 'TabStateProvider'
      ? 'Tabs'
      : availableName('Tabs', 'TabsRoot'));
  let flexName = 'Flex';
  const layoutImport = imports.find(
    node =>
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === layoutModule &&
      !node.importClause?.isTypeOnly
  );
  if (
    layoutImport?.importClause?.namedBindings &&
    ts.isNamedImports(layoutImport.importClause.namedBindings)
  ) {
    const flexImport = layoutImport.importClause.namedBindings.elements.find(
      specifier => (specifier.propertyName ?? specifier.name).text === 'Flex'
    );
    if (flexImport) {
      flexName = flexImport.name.text;
    }
  }
  const hasImportedFlex =
    layoutImport?.importClause?.namedBindings &&
    ts.isNamedImports(layoutImport.importClause.namedBindings) &&
    layoutImport.importClause.namedBindings.elements.some(
      specifier => (specifier.propertyName ?? specifier.name).text === 'Flex'
    );
  if (!hasImportedFlex) {
    flexName = availableName('Flex', 'TabsFlex');
  }
  const edits: Edit[] = [];
  let needsFlex = false;
  function replaceRoot(root: ts.JsxElement): string {
    const opening = root.openingElement;
    const localName = opening.tagName.getText(sourceFile);
    const provider = bindings.get(localName)?.exported === 'TabStateProvider';
    const orientation = opening.attributes.properties.find(
      attribute =>
        ts.isJsxAttribute(attribute) &&
        attribute.name.getText(sourceFile) === 'orientation'
    );
    const vertical =
      orientation &&
      ts.isJsxAttribute(orientation) &&
      orientation.initializer &&
      ts.isStringLiteral(orientation.initializer) &&
      orientation.initializer.text === 'vertical';
    const cssAttributes = opening.attributes.properties.filter(
      attribute =>
        ts.isJsxAttribute(attribute) &&
        ['className', 'css'].includes(attribute.name.getText(sourceFile))
    );
    const openingEdits: Edit[] = [];
    if (provider) {
      openingEdits.push({
        start: opening.tagName.getStart(),
        end: opening.tagName.end,
        text: tabsName,
      });
    }
    for (const attribute of cssAttributes) {
      openingEdits.push({start: attribute.pos, end: attribute.end, text: ''});
    }
    const openingText = applyEdits(
      source.slice(opening.getStart(), opening.end),
      openingEdits.map(edit => ({
        ...edit,
        start: edit.start - opening.getStart(),
        end: edit.end - opening.getStart(),
      }))
    );
    const directNested: ts.JsxElement[] = pending.filter(
      candidate =>
        candidate !== root &&
        isInside(candidate, root) &&
        !pending.some(
          intermediate =>
            intermediate !== root &&
            intermediate !== candidate &&
            isInside(candidate, intermediate) &&
            isInside(intermediate, root)
        )
    );
    const childStart = opening.end;
    const childEnd = root.closingElement.getStart();
    let children = source.slice(childStart, childEnd);
    children = applyEdits(
      children,
      directNested.map(child => ({
        start: child.getStart() - childStart,
        end: child.end - childStart,
        text: replaceRoot(child),
      }))
    );
    const usedChildren = new Set<string>();
    walk(root, node => {
      if (!ts.isIdentifier(node)) {
        return;
      }
      const binding = bindings.get(node.text);
      if (!binding || !childExports.has(binding.exported)) {
        return;
      }
      const nestedOwner = roots.find(
        candidate =>
          candidate !== root && isInside(node, candidate) && isInside(candidate, root)
      );
      if (!nestedOwner) {
        usedChildren.add(node.text);
      }
    });
    const parameters = Array.from(usedChildren, local => {
      const exported = bindings.get(local)?.exported;
      return exported === local ? exported : `${exported}: ${local}`;
    }).join(', ');
    const callback = parameters ? `{({${parameters}}) => (` : '{() => (';
    let body: string;
    if (provider) {
      body = `<>${children}</>`;
    } else {
      needsFlex = true;
      const attrs = vertical
        ? 'direction="row" flexGrow={1} minWidth="0" flexBasis="auto" alignSelf="auto" height="100%" align="stretch"'
        : 'direction="column" flexGrow={1} minWidth="0" flexBasis="0" alignSelf="stretch"';
      const moved = cssAttributes
        .map(attribute => source.slice(attribute.getStart(), attribute.end))
        .join(' ');
      body = `<${flexName} ${attrs}${moved ? ` ${moved}` : ''}>${children}</${flexName}>`;
    }
    return `${openingText}\n${callback}\n${body}\n)}\n</${provider ? tabsName : localName}>`;
  }
  for (const root of pending.filter(
    candidate =>
      !pending.some(parent => parent !== candidate && isInside(candidate, parent))
  )) {
    edits.push({start: root.getStart(), end: root.end, text: replaceRoot(root)});
  }
  for (const declaration of tabsImports) {
    const clause = declaration.importClause;
    const named = clause?.namedBindings;
    if (!clause || !named || !ts.isNamedImports(named)) {
      continue;
    }
    const elements = named.elements;
    const kept: string[] = [];
    for (const specifier of elements) {
      const local = specifier.name.text;
      const binding = bindings.get(local);
      if (!binding) {
        continue;
      }
      const outsideUse: ts.Node[] = [];
      walk(sourceFile, node => {
        if (
          ts.isIdentifier(node) &&
          node.text === local &&
          !isImportIdentifier(node) &&
          !pending.some(root => isInside(node, root))
        ) {
          outsideUse.push(node);
        }
      });
      if (childExports.has(binding.exported) && !outsideUse.length) {
        continue;
      }
      if (binding.exported === 'TabStateProvider' && !outsideUse.length) {
        if (
          !existingTabs &&
          !kept.some(item => item === 'Tabs' || item === `Tabs as ${tabsName}`)
        ) {
          kept.push(tabsName === 'Tabs' ? 'Tabs' : `Tabs as ${tabsName}`);
        }
        continue;
      }
      kept.push(source.slice(specifier.getStart(), specifier.end));
    }
    edits.push({
      start: declaration.getStart(),
      end: declaration.end,
      text: kept.length
        ? `import ${clause.isTypeOnly ? 'type ' : ''}{${kept.join(', ')}} from '${tabsModule}';`
        : '',
    });
  }
  if (needsFlex) {
    const named = layoutImport?.importClause?.namedBindings;
    const existingFlex =
      named &&
      ts.isNamedImports(named) &&
      named.elements.some(
        specifier => (specifier.propertyName ?? specifier.name).text === 'Flex'
      );
    if (!existingFlex && named && ts.isNamedImports(named)) {
      const importNames = named.elements.map(specifier =>
        source.slice(specifier.getStart(), specifier.end)
      );
      edits.push({
        start: named.getStart(),
        end: named.end,
        text: `{${[...importNames, flexName === 'Flex' ? 'Flex' : `Flex as ${flexName}`].join(', ')}}`,
      });
    } else if (!existingFlex) {
      const firstTabsImport = tabsImports[0];
      if (!firstTabsImport) {
        throw new Error('Missing tabs import');
      }
      edits.push({
        start: firstTabsImport.getStart(),
        end: firstTabsImport.getStart(),
        text: `import {${flexName === 'Flex' ? 'Flex' : `Flex as ${flexName}`}} from '${layoutModule}';\n`,
      });
    }
  }
  const result = applyEdits(source, edits);
  return {source: result, status: 'changed', notes: [...new Set(notes)]};
}

function main(): void {
  const args = process.argv.slice(2);
  const rootArgument = args.indexOf('--root');
  const rootValue = args[rootArgument + 1];
  if (rootArgument >= 0 && (!rootValue || rootValue.startsWith('--'))) {
    throw new Error('--root needs a directory');
  }
  const root = rootArgument >= 0 && rootValue ? path.resolve(rootValue) : process.cwd();
  const outputArgument = args.indexOf('--out');
  const outputValue = args[outputArgument + 1];
  if (outputArgument >= 0 && (!outputValue || outputValue.startsWith('--'))) {
    throw new Error('--out needs a directory');
  }
  const output = outputArgument >= 0 && outputValue ? path.resolve(outputValue) : null;
  const write = args.includes('--write');
  const paths = args.filter(
    (argument, index) =>
      !argument.startsWith('--') &&
      !(rootArgument >= 0 && index === rootArgument + 1) &&
      !(outputArgument >= 0 && index === outputArgument + 1)
  );
  const files = paths.length
    ? paths
    : cp
        .execFileSync('git', ['ls-files', 'static'], {cwd: root, encoding: 'utf8'})
        .trim()
        .split('\n');
  const report: Array<{file: string; notes: string[]; status: Result['status']}> = [];
  for (const file of files.filter(candidate => /\.(tsx|mdx)$/.test(candidate))) {
    const filename = path.join(root, file);
    const source = fs.readFileSync(filename, 'utf8');
    if (!source.includes(tabsModule)) {
      continue;
    }
    try {
      const result = transform(source, file);
      report.push({file, status: result.status, notes: result.notes});
      if (result.status === 'changed') {
        if (output) {
          const target = path.join(output, file);
          fs.mkdirSync(path.dirname(target), {recursive: true});
          fs.writeFileSync(target, result.source);
        }
        if (write) {
          fs.writeFileSync(filename, result.source);
        }
      }
    } catch (error) {
      report.push({
        file,
        status: 'skipped',
        notes: [error instanceof Error ? error.message : String(error)],
      });
    }
  }
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
