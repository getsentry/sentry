import {
  type Fix,
  type Fixer,
  defineRule,
  type ESTree,
  type Context,
} from '@oxlint/plugins';

import {createImportTracker} from '../ast/tracker/imports.ts';
import {removeJsxAttributes} from '../ast/utils/removeJsxAttributes.ts';

const LAYOUT_SOURCE = '@sentry/scraps/layout';

type ImportTracker = ReturnType<typeof createImportTracker>;

/**
 * Returns the `direction` attribute when it is set to the literal string
 * "column" (`direction="column"` or `direction={'column'}`). Responsive or
 * otherwise dynamic values (`direction={{...}}`, ternaries, variables) are not
 * matched, since those cannot be expressed by <Stack>'s static default.
 */
function getColumnDirectionAttribute(
  opening: ESTree.JSXOpeningElement
): ESTree.JSXAttribute | null {
  const attr = opening.attributes.find(
    (attribute): attribute is ESTree.JSXAttribute =>
      attribute.type === 'JSXAttribute' && attribute.name.name === 'direction'
  );
  const value =
    attr?.value?.type === 'JSXExpressionContainer' ? attr.value.expression : attr?.value;
  return attr && value?.type === 'Literal' && value.value === 'column' ? attr : null;
}

function getStackImportFix(
  fixer: Fixer,
  flexImport: ESTree.ImportDeclaration
): Fix | null {
  const specifiers = flexImport.specifiers.filter(
    (spec): spec is ESTree.ImportSpecifier => spec.type === 'ImportSpecifier'
  );
  // Insert Stack in alphabetical position among the named imports.
  const after = specifiers.find(
    spec =>
      (spec.imported.type === 'Identifier'
        ? spec.imported.name
        : spec.imported.value
      ).localeCompare('Stack') > 0
  );
  if (after) {
    return fixer.insertTextBefore(after, 'Stack, ');
  }
  const lastSpecifier = specifiers.at(-1);
  return lastSpecifier ? fixer.insertTextAfter(lastSpecifier, ', Stack') : null;
}

/** Renames Flex -> Stack, drops the redundant `direction` prop, and ensures the import. */
function buildStackFix(
  fixer: Fixer,
  node: ESTree.JSXElement,
  directionAttr: ESTree.JSXAttribute,
  context: Context,
  importTracker: ImportTracker
): Fix[] {
  const openingName = node.openingElement.name;
  const closingName = node.closingElement?.name;
  const fixes: Fix[] = [];

  if (openingName.type === 'JSXMemberExpression') {
    // Namespace form (`<Layout.Flex>`): rename only the `.Flex` member to
    // `.Stack`, keeping the namespace prefix. No import fix is needed since the
    // namespace already exposes Stack.
    fixes.push(fixer.replaceText(openingName.property, 'Stack'));
    if (closingName?.type === 'JSXMemberExpression') {
      fixes.push(fixer.replaceText(closingName.property, 'Stack'));
    }
  } else {
    // Named form (`<Flex>`): rename the element and ensure Stack is imported.
    const [existingStackName] = importTracker.findLocalNames(LAYOUT_SOURCE, 'Stack');
    const stackName = existingStackName ?? 'Stack';
    fixes.push(fixer.replaceText(openingName, stackName));
    if (closingName) {
      fixes.push(fixer.replaceText(closingName, stackName));
    }
    const flexImport = importTracker.resolveVariable(openingName)?.defs[0]?.parent;
    if (!existingStackName && flexImport?.type === 'ImportDeclaration') {
      const importFix = getStackImportFix(fixer, flexImport);
      if (importFix) {
        fixes.push(importFix);
      }
    }
  }

  fixes.push(removeJsxAttributes(fixer, context.sourceCode, directionAttr));

  return fixes;
}

export const preferStackForColumnFlex = defineRule({
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
    const importTracker = createImportTracker(context);

    return {
      JSXElement(node) {
        if (!importTracker.is(node.openingElement.name, LAYOUT_SOURCE, 'Flex')) {
          return;
        }
        const {attributes} = node.openingElement;
        const directionAttr = getColumnDirectionAttribute(node.openingElement);
        if (!directionAttr) {
          return;
        }
        const spreadBeforeDirection = attributes
          .slice(0, attributes.indexOf(directionAttr))
          .some(attr => attr.type === 'JSXSpreadAttribute');

        context.report({
          node: directionAttr,
          messageId: 'preferStack',
          fix: spreadBeforeDirection
            ? undefined
            : fixer => buildStackFix(fixer, node, directionAttr, context, importTracker),
        });
      },
    };
  },
});
