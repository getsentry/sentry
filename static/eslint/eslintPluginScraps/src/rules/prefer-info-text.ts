import {AST_NODE_TYPES, ESLintUtils, type TSESTree} from '@typescript-eslint/utils';

import {createImportTracker} from '../ast/tracker/imports';

const TOOLTIP_SOURCE = '@sentry/scraps/tooltip';
const TEXT_SOURCE = '@sentry/scraps/text';
const I18N_FUNCTIONS = new Set(['t', 'tct']);

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

function isI18nCall(node: TSESTree.Expression): boolean {
  return (
    node.type === AST_NODE_TYPES.CallExpression &&
    node.callee.type === AST_NODE_TYPES.Identifier &&
    I18N_FUNCTIONS.has(node.callee.name)
  );
}

export const preferInfoText = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer <InfoText> over <Tooltip> wrapping text content.',
    },
    schema: [],
    messages: {
      preferInfoText:
        "Prefer <InfoText> over <Tooltip> wrapping text content. Import InfoText from '@sentry/scraps/info'.",
    },
  },

  create(context) {
    const importTracker = createImportTracker();
    let resolved = false;
    let tooltipNames: string[] = [];
    let textNames: string[] = [];

    function resolveNames() {
      if (resolved) return;
      resolved = true;
      tooltipNames = importTracker.findLocalNames(TOOLTIP_SOURCE, 'Tooltip');
      textNames = importTracker.findLocalNames(TEXT_SOURCE, 'Text');
    }

    function isTextLikeExpression(expr: TSESTree.Expression): boolean {
      switch (expr.type) {
        case AST_NODE_TYPES.Literal:
          return typeof expr.value === 'string';
        case AST_NODE_TYPES.TemplateLiteral:
          return true;
        case AST_NODE_TYPES.CallExpression:
          return isI18nCall(expr);
        case AST_NODE_TYPES.ConditionalExpression:
          return (
            isTextLikeExpression(expr.consequent) && isTextLikeExpression(expr.alternate)
          );
        case AST_NODE_TYPES.LogicalExpression:
          if (expr.operator === '&&') {
            return isTextLikeExpression(expr.right);
          }
          return isTextLikeExpression(expr.left) && isTextLikeExpression(expr.right);
        default:
          return false;
      }
    }

    function isTextLikeChild(child: TSESTree.JSXChild): boolean {
      switch (child.type) {
        case AST_NODE_TYPES.JSXText:
          return child.value.trim().length > 0;
        case AST_NODE_TYPES.JSXExpressionContainer:
          if (child.expression.type === AST_NODE_TYPES.JSXEmptyExpression) {
            return false;
          }
          return isTextLikeExpression(child.expression);
        case AST_NODE_TYPES.JSXElement: {
          const name = getElementName(child.openingElement.name);
          if (name === 'span' || textNames.includes(name)) {
            return allChildrenAreTextLike(child.children);
          }
          return false;
        }
        case AST_NODE_TYPES.JSXFragment:
          return allChildrenAreTextLike(child.children);
        default:
          return false;
      }
    }

    function allChildrenAreTextLike(children: TSESTree.JSXChild[]): boolean {
      const meaningful = children.filter(
        c => !(c.type === AST_NODE_TYPES.JSXText && c.value.trim() === '')
      );
      return meaningful.length > 0 && meaningful.every(isTextLikeChild);
    }

    return {
      ...importTracker.visitors,

      JSXElement(node) {
        resolveNames();
        const name = getElementName(node.openingElement.name);
        if (!tooltipNames.includes(name)) {
          return;
        }
        if (allChildrenAreTextLike(node.children)) {
          context.report({
            node,
            messageId: 'preferInfoText',
          });
        }
      },
    };
  },
});
