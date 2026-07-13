import {
  AST_NODE_TYPES,
  ESLintUtils,
  type TSESLint,
  type TSESTree,
} from '@typescript-eslint/utils';

import {createImportTracker} from '../ast/tracker/imports';

const LAYOUT_SOURCE = '@sentry/scraps/layout';

type MessageIds = 'preferStack';
type Context = TSESLint.RuleContext<MessageIds, readonly unknown[]>;
type ImportTracker = ReturnType<typeof createImportTracker>;

function getElementName(nameNode: TSESTree.JSXTagNameExpression): string {
  switch (nameNode.type) {
    case AST_NODE_TYPES.JSXIdentifier:
      return nameNode.name;
    case AST_NODE_TYPES.JSXMemberExpression:
      return `${getElementName(nameNode.object)}.${nameNode.property.name}`;
    case AST_NODE_TYPES.JSXNamespacedName:
      return `${nameNode.namespace.name}:${nameNode.name.name}`;
  }
}

/**
 * Returns the `direction` attribute when it is set to the literal string
 * "column" (`direction="column"` or `direction={'column'}`). Responsive or
 * otherwise dynamic values (`direction={{...}}`, ternaries, variables) are not
 * matched, since those cannot be expressed by <Stack>'s static default.
 */
function getColumnDirectionAttribute(
  opening: TSESTree.JSXOpeningElement
): TSESTree.JSXAttribute | null {
  for (const attr of opening.attributes) {
    if (
      attr.type !== AST_NODE_TYPES.JSXAttribute ||
      attr.name.type !== AST_NODE_TYPES.JSXIdentifier ||
      attr.name.name !== 'direction'
    ) {
      continue;
    }
    const value = attr.value;
    if (value?.type === AST_NODE_TYPES.Literal && value.value === 'column') {
      return attr;
    }
    if (
      value?.type === AST_NODE_TYPES.JSXExpressionContainer &&
      value.expression.type === AST_NODE_TYPES.Literal &&
      value.expression.value === 'column'
    ) {
      return attr;
    }
    return null;
  }
  return null;
}

function getStackLocalName(importTracker: ImportTracker): string {
  return importTracker.findLocalNames(LAYOUT_SOURCE, 'Stack')[0] ?? 'Stack';
}

/** Adds `Stack` to the existing layout import, or a fresh import if none exists. */
function getStackImportFix(
  fixer: TSESLint.RuleFixer,
  context: Context,
  importTracker: ImportTracker
): TSESLint.RuleFix | null {
  if (importTracker.findLocalNames(LAYOUT_SOURCE, 'Stack').length > 0) {
    return null;
  }

  const layoutImport = context.sourceCode.ast.body.find(
    (node): node is TSESTree.ImportDeclaration =>
      node.type === AST_NODE_TYPES.ImportDeclaration &&
      node.source.value === LAYOUT_SOURCE
  );

  // The element resolves to Flex from the layout module, so an import from
  // that source always exists; fall back to a fresh import defensively.
  if (!layoutImport) {
    return fixer.insertTextBeforeRange(
      [0, 0],
      `import {Stack} from '${LAYOUT_SOURCE}';\n`
    );
  }

  const specifiers = layoutImport.specifiers.filter(
    (spec): spec is TSESTree.ImportSpecifier =>
      spec.type === AST_NODE_TYPES.ImportSpecifier
  );
  const lastSpecifier = specifiers.at(-1);
  if (!lastSpecifier) {
    return null;
  }

  // Insert Stack in alphabetical position among the named imports.
  const after = specifiers.find(
    spec =>
      (spec.imported.type === AST_NODE_TYPES.Identifier
        ? spec.imported.name
        : spec.imported.value
      ).localeCompare('Stack') > 0
  );
  if (after) {
    return fixer.insertTextBefore(after, 'Stack, ');
  }
  return fixer.insertTextAfter(lastSpecifier, ', Stack');
}

/** Renames Flex -> Stack, drops the redundant `direction` prop, and ensures the import. */
function buildStackFix(
  fixer: TSESLint.RuleFixer,
  node: TSESTree.JSXElement,
  directionAttr: TSESTree.JSXAttribute,
  context: Context,
  importTracker: ImportTracker
): TSESLint.RuleFix[] {
  const stackName = getStackLocalName(importTracker);
  const fixes: TSESLint.RuleFix[] = [
    fixer.replaceText(node.openingElement.name, stackName),
  ];
  if (node.closingElement) {
    fixes.push(fixer.replaceText(node.closingElement.name, stackName));
  }

  // Remove the now-redundant direction attribute along with its leading
  // whitespace. If it sits alone on its own line, drop the whole line
  // (including the preceding newline).
  const src = context.sourceCode.getText();
  let start = directionAttr.range[0];
  while (start > 0 && (src[start - 1] === ' ' || src[start - 1] === '\t')) {
    start--;
  }
  if (src[start - 1] === '\n') {
    start--;
  }
  fixes.push(fixer.removeRange([start, directionAttr.range[1]]));

  const importFix = getStackImportFix(fixer, context, importTracker);
  if (importFix !== null) {
    fixes.push(importFix);
  }
  return fixes;
}

export const preferStackForColumnFlex = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Prefer <Stack> over <Flex direction="column">. Stack is Flex with a column direction by default.',
    },
    fixable: 'code',
    schema: [],
    messages: {
      preferStack:
        'Prefer <Stack> over <Flex direction="column">. Stack is Flex with a column direction by default. Import Stack from \'@sentry/scraps/layout\'.',
    },
  },

  create(context) {
    const importTracker = createImportTracker();

    return {
      ...importTracker.visitors,

      JSXElement(node) {
        const flexNames = importTracker.findLocalNames(LAYOUT_SOURCE, 'Flex');
        const name = getElementName(node.openingElement.name);
        if (!flexNames.includes(name)) {
          return;
        }
        const directionAttr = getColumnDirectionAttribute(node.openingElement);
        if (!directionAttr) {
          return;
        }

        context.report({
          node: directionAttr,
          messageId: 'preferStack',
          fix: fixer => buildStackFix(fixer, node, directionAttr, context, importTracker),
        });
      },
    };
  },
});
