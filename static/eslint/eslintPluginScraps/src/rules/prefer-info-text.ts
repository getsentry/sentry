import {
  AST_NODE_TYPES,
  ESLintUtils,
  type TSESLint,
  type TSESTree,
} from '@typescript-eslint/utils';

import {createImportTracker} from '../ast/tracker/imports';

const TOOLTIP_SOURCE = '@sentry/scraps/tooltip';
const TEXT_SOURCE = '@sentry/scraps/text';
const INFO_SOURCE = '@sentry/scraps/info';
const LOCALE_SOURCE = 'sentry/locale';
const I18N_FUNCTIONS = new Set(['t', 'tct']);
const TEXT_LIKE_INTRINSICS = new Set([
  'a',
  'abbr',
  'b',
  'code',
  'del',
  'em',
  'i',
  'kbd',
  'label',
  'mark',
  'p',
  's',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'u',
]);
const TOOLTIP_PROPS_SUPPORTED_BY_INFO_TEXT = new Set(['title', 'showUnderline']);
const TOOLTIP_PROPS_TO_STRIP = new Set(['showUnderline']);

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

function isI18nCall(node: TSESTree.Expression, i18nNames: string[]): boolean {
  return (
    node.type === AST_NODE_TYPES.CallExpression &&
    node.callee.type === AST_NODE_TYPES.Identifier &&
    i18nNames.includes(node.callee.name)
  );
}

export const preferInfoText = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer <InfoText> over <Tooltip> wrapping text content.',
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      preferInfoText:
        "Prefer <InfoText> over <Tooltip> wrapping text content. Import InfoText from '@sentry/scraps/info'.",
      replaceWithInfoText: 'Replace <Tooltip> with <InfoText>.',
    },
  },

  create(context) {
    const importTracker = createImportTracker();
    let resolved = false;
    let tooltipNames: string[] = [];
    let textNames: string[] = [];
    let i18nNames: string[] = [];

    function resolveNames() {
      if (resolved) {
        return;
      }
      resolved = true;
      tooltipNames = importTracker.findLocalNames(TOOLTIP_SOURCE, 'Tooltip');
      textNames = importTracker.findLocalNames(TEXT_SOURCE, 'Text');
      i18nNames = Array.from(I18N_FUNCTIONS).flatMap(name =>
        importTracker.findLocalNames(LOCALE_SOURCE, name)
      );
    }

    function isTextLikeExpression(expr: TSESTree.Expression): boolean {
      switch (expr.type) {
        case AST_NODE_TYPES.Literal:
          return typeof expr.value === 'string';
        case AST_NODE_TYPES.TemplateLiteral:
          return true;
        case AST_NODE_TYPES.CallExpression:
          return isI18nCall(expr, i18nNames);
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
          if (TEXT_LIKE_INTRINSICS.has(name) || textNames.includes(name)) {
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

    function getMeaningfulChildren(children: TSESTree.JSXChild[]) {
      return children.filter(
        child => !(child.type === AST_NODE_TYPES.JSXText && child.value.trim() === '')
      );
    }

    function getSingleTextElementChild(node: TSESTree.JSXElement) {
      const meaningfulChildren = getMeaningfulChildren(node.children);
      const child = meaningfulChildren[0];
      if (meaningfulChildren.length !== 1 || !child) {
        return null;
      }

      if (child.type !== AST_NODE_TYPES.JSXElement || child.closingElement === null) {
        return null;
      }

      const name = getElementName(child.openingElement.name);
      if (!textNames.includes(name)) {
        return null;
      }

      return child;
    }

    function canSuggestInfoText(node: TSESTree.JSXElement): boolean {
      if (node.openingElement.selfClosing || node.closingElement === null) {
        return false;
      }

      if (!allChildrenAreTextLike(node.children)) {
        return false;
      }

      return node.openingElement.attributes.every(attr => {
        if (attr.type !== AST_NODE_TYPES.JSXAttribute) {
          return false;
        }
        return (
          attr.name.type === AST_NODE_TYPES.JSXIdentifier &&
          TOOLTIP_PROPS_SUPPORTED_BY_INFO_TEXT.has(attr.name.name)
        );
      });
    }

    function getInfoTextName() {
      return importTracker.findLocalNames(INFO_SOURCE, 'InfoText')[0] ?? 'InfoText';
    }

    function getInfoTextImportFix(fixer: TSESLint.RuleFixer) {
      if (importTracker.findLocalNames(INFO_SOURCE, 'InfoText').length > 0) {
        return null;
      }

      const imports = context.sourceCode.ast.body.filter(
        node => node.type === AST_NODE_TYPES.ImportDeclaration
      );
      const infoImport = `import {InfoText} from '${INFO_SOURCE}';\n`;
      const lastImport = imports.at(-1);

      if (lastImport) {
        return fixer.insertTextAfter(lastImport, `\n${infoImport}`);
      }
      return fixer.insertTextBeforeRange([0, 0], infoImport);
    }

    function getAttributeText(
      attributes: TSESTree.JSXOpeningElement['attributes'],
      stripNames?: Set<string>
    ) {
      return attributes
        .filter(attr => {
          if (!stripNames) {
            return true;
          }
          return !(
            attr.type === AST_NODE_TYPES.JSXAttribute &&
            attr.name.type === AST_NODE_TYPES.JSXIdentifier &&
            stripNames.has(attr.name.name)
          );
        })
        .map(attr => context.sourceCode.getText(attr))
        .join(' ');
    }

    function buildOpeningTag(name: string, attributes: string[]) {
      const attributeText = attributes.filter(Boolean).join(' ');
      return attributeText ? `<${name} ${attributeText}>` : `<${name}>`;
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
            suggest: canSuggestInfoText(node)
              ? [
                  {
                    messageId: 'replaceWithInfoText',
                    fix(fixer) {
                      if (!node.closingElement) {
                        return null;
                      }
                      const infoTextName = getInfoTextName();
                      const textChild = getSingleTextElementChild(node);
                      if (textChild && textChild.closingElement !== null) {
                        const attributes = [
                          getAttributeText(
                            node.openingElement.attributes,
                            TOOLTIP_PROPS_TO_STRIP
                          ),
                          getAttributeText(textChild.openingElement.attributes),
                        ];
                        const childrenText = context.sourceCode.text.slice(
                          textChild.openingElement.range[1],
                          textChild.closingElement.range[0]
                        );
                        const replacement = `${buildOpeningTag(
                          infoTextName,
                          attributes
                        )}${childrenText}</${infoTextName}>`;
                        const fixes = [fixer.replaceText(node, replacement)];
                        const importFix = getInfoTextImportFix(fixer);
                        if (importFix !== null) {
                          fixes.push(importFix);
                        }
                        return fixes;
                      }

                      const fixes: TSESLint.RuleFix[] = [
                        fixer.replaceText(node.openingElement.name, infoTextName),
                        fixer.replaceText(node.closingElement.name, infoTextName),
                        fixer.insertTextAfter(
                          node.openingElement.name,
                          ' variant="inherit"'
                        ),
                      ];
                      for (const attr of node.openingElement.attributes) {
                        if (
                          attr.type === AST_NODE_TYPES.JSXAttribute &&
                          attr.name.type === AST_NODE_TYPES.JSXIdentifier &&
                          TOOLTIP_PROPS_TO_STRIP.has(attr.name.name)
                        ) {
                          const src = context.sourceCode.getText();
                          let start = attr.range[0];
                          while (start > 0 && src[start - 1] === ' ') {
                            start--;
                          }
                          fixes.push(fixer.removeRange([start, attr.range[1]]));
                        }
                      }
                      const importFix = getInfoTextImportFix(fixer);
                      if (importFix !== null) {
                        fixes.push(importFix);
                      }
                      return fixes;
                    },
                  },
                ]
              : undefined,
          });
        }
      },
    };
  },
});
