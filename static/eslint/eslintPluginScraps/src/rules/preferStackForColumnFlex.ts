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

/**
 * Whether a JSX tag resolves to layout's `Flex`, either as a named import
 * (`<Flex>`) or via a namespace import (`import * as Layout` -> `<Layout.Flex>`).
 */
function isLayoutFlexElement(
  nameNode: TSESTree.JSXTagNameExpression,
  importTracker: ImportTracker
): boolean {
  if (nameNode.type === AST_NODE_TYPES.JSXIdentifier) {
    return importTracker.findLocalNames(LAYOUT_SOURCE, 'Flex').includes(nameNode.name);
  }
  if (
    nameNode.type === AST_NODE_TYPES.JSXMemberExpression &&
    nameNode.object.type === AST_NODE_TYPES.JSXIdentifier &&
    nameNode.property.name === 'Flex'
  ) {
    const info = importTracker.resolve(nameNode.object.name);
    return info?.source === LAYOUT_SOURCE && info.imported === '*';
  }
  return false;
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
  const openingName = node.openingElement.name;
  const closingName = node.closingElement?.name;
  const fixes: TSESLint.RuleFix[] = [];

  if (openingName.type === AST_NODE_TYPES.JSXMemberExpression) {
    // Namespace form (`<Layout.Flex>`): rename only the `.Flex` member to
    // `.Stack`, keeping the namespace prefix. No import fix is needed since the
    // namespace already exposes Stack.
    fixes.push(fixer.replaceText(openingName.property, 'Stack'));
    if (closingName?.type === AST_NODE_TYPES.JSXMemberExpression) {
      fixes.push(fixer.replaceText(closingName.property, 'Stack'));
    }
  } else {
    // Named form (`<Flex>`): rename the element and ensure Stack is imported.
    const stackName = getStackLocalName(importTracker);
    fixes.push(fixer.replaceText(openingName, stackName));
    if (closingName) {
      fixes.push(fixer.replaceText(closingName, stackName));
    }
    const importFix = getStackImportFix(fixer, context, importTracker);
    if (importFix !== null) {
      fixes.push(importFix);
    }
  }

  // Remove the now-redundant direction attribute along with the whitespace
  // separating it from the previous token, so an attribute alone on its own
  // line takes the whole line (including the preceding newline) with it.
  // includeComments keeps a preceding comment from being swallowed by the range.
  const tokenBefore = context.sourceCode.getTokenBefore(directionAttr, {
    includeComments: true,
  });
  const start = tokenBefore ? tokenBefore.range[1] : directionAttr.range[0];
  fixes.push(fixer.removeRange([start, directionAttr.range[1]]));

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
        if (!isLayoutFlexElement(node.openingElement.name, importTracker)) {
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
