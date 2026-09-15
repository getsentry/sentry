import type {Fix} from '@oxlint/plugins';
import type {Fixer} from '@oxlint/plugins';
import {defineRule, type ESTree} from '@oxlint/plugins';

import {createImportTracker} from '../ast/tracker/imports.ts';

const TOOLTIP_SOURCE = '@sentry/scraps/tooltip';
const TEXT_SOURCE = '@sentry/scraps/text';
const INFO_SOURCE = '@sentry/scraps/info';
const LOCALE_SOURCE = 'sentry/locale';
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
const TOOLTIP_PROPS_SUPPORTED_BY_INFO_TEXT = new Set([
  'title',
  'position',
  'maxWidth',
  'delay',
  'showUnderline',
  // InfoText always renders its underlying Tooltip as hoverable.
  'isHoverable',
]);
const TOOLTIP_PROPS_TO_STRIP = new Set(['showUnderline', 'isHoverable', 'skipWrapper']);
const TOOLTIP_PROPS_TO_RENAME = new Map([['showOnlyOnOverflow', 'mode="overflowOnly"']]);
const TEXT_PROPS_TO_STRIP = new Set(['underline']);
const TEXT_PROPS_TO_STRIP_IN_OVERFLOW_ONLY = new Set(['ellipsis']);

function getElementName(nameNode: ESTree.JSXElementName): string {
  switch (nameNode.type) {
    case 'JSXIdentifier':
      return nameNode.name;
    case 'JSXMemberExpression':
      return `${getElementName(nameNode.object)}.${nameNode.property.name}`;
    case 'JSXNamespacedName':
      return `${nameNode.namespace.name}:${nameNode.name.name}`;
  }
}

function isI18nCall(node: ESTree.Expression, i18nNames: string[]): boolean {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    i18nNames.includes(node.callee.name)
  );
}

export const preferInfoText = defineRule({
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

    function isLocaleCall(node: ESTree.Expression): boolean {
      return (
        node.type === 'CallExpression' &&
        node.callee.type === 'Identifier' &&
        importTracker.resolve(node.callee.name)?.source === LOCALE_SOURCE
      );
    }

    function resolveNames() {
      if (resolved) {
        return;
      }
      resolved = true;
      tooltipNames = importTracker.findLocalNames(TOOLTIP_SOURCE, 'Tooltip');
      textNames = importTracker.findLocalNames(TEXT_SOURCE, 'Text');
    }

    function isTextLikeExpression(expr: ESTree.Expression): boolean {
      switch (expr.type) {
        case 'Literal':
          return typeof expr.value === 'string';
        case 'TemplateLiteral':
          return true;
        case 'CallExpression':
          return isLocaleCall(expr);
        case 'ConditionalExpression':
          return (
            isTextLikeExpression(expr.consequent) && isTextLikeExpression(expr.alternate)
          );
        case 'LogicalExpression':
          if (expr.operator === '&&') {
            return isTextLikeExpression(expr.right);
          }
          return isTextLikeExpression(expr.left) && isTextLikeExpression(expr.right);
        default:
          return false;
      }
    }

    function isTextLikeChild(child: ESTree.JSXChild): boolean {
      switch (child.type) {
        case 'JSXText':
          return child.value.trim().length > 0;
        case 'JSXExpressionContainer':
          if (child.expression.type === 'JSXEmptyExpression') {
            return false;
          }
          return isTextLikeExpression(child.expression);
        case 'JSXElement': {
          const name = getElementName(child.openingElement.name);
          // Text is intended to render text content, so do not require the
          // expression inside it to be statically recognizable as text.
          if (textNames.includes(name)) {
            return true;
          }
          if (TEXT_LIKE_INTRINSICS.has(name)) {
            return allChildrenAreTextLike(child.children);
          }
          return false;
        }
        case 'JSXFragment':
          return allChildrenAreTextLike(child.children);
        default:
          return false;
      }
    }

    function allChildrenAreTextLike(children: ESTree.JSXChild[]): boolean {
      const meaningful = children.filter(
        c => !(c.type === 'JSXText' && c.value.trim() === '')
      );
      return meaningful.length > 0 && meaningful.every(isTextLikeChild);
    }

    function getMeaningfulChildren(children: ESTree.JSXChild[]) {
      return children.filter(
        child => !(child.type === 'JSXText' && child.value.trim() === '')
      );
    }

    function getSingleTextElementChild(node: ESTree.JSXElement) {
      const meaningfulChildren = getMeaningfulChildren(node.children);
      const child = meaningfulChildren[0];
      if (meaningfulChildren.length !== 1 || !child) {
        return null;
      }

      if (child.type !== 'JSXElement' || child.closingElement === null) {
        return null;
      }

      const name = getElementName(child.openingElement.name);
      if (!textNames.includes(name)) {
        return null;
      }

      return child;
    }

    function canSuggestInfoText(node: ESTree.JSXElement): boolean {
      if (node.openingElement.selfClosing || node.closingElement === null) {
        return false;
      }

      if (!allChildrenAreTextLike(node.children)) {
        return false;
      }

      return node.openingElement.attributes.every(attr => {
        if (attr.type !== 'JSXAttribute') {
          return false;
        }

        if (
          attr.name.type === 'JSXIdentifier' &&
          (attr.name.name === 'showOnlyOnOverflow' ||
            attr.name.name === 'isHoverable' ||
            attr.name.name === 'skipWrapper')
        ) {
          return (
            attr.value === null ||
            (attr.value.type === 'JSXExpressionContainer' &&
              attr.value.expression.type === 'Literal' &&
              attr.value.expression.value === true)
          );
        }

        return (
          attr.name.type === 'JSXIdentifier' &&
          TOOLTIP_PROPS_SUPPORTED_BY_INFO_TEXT.has(attr.name.name)
        );
      });
    }

    function getInfoTextName() {
      return importTracker.findLocalNames(INFO_SOURCE, 'InfoText')[0] ?? 'InfoText';
    }

    function getInfoTextImportFix(fixer: Fixer) {
      if (importTracker.findLocalNames(INFO_SOURCE, 'InfoText').length > 0) {
        return null;
      }

      const imports = context.sourceCode.ast.body.filter(
        node => node.type === 'ImportDeclaration'
      );
      const infoImport = `import {InfoText} from '${INFO_SOURCE}';\n`;
      const lastImport = imports.at(-1);

      if (lastImport) {
        return fixer.insertTextAfter(lastImport, `\n${infoImport}`);
      }
      return fixer.insertTextBeforeRange([0, 0], infoImport);
    }

    function getAttributeText(
      attributes: ESTree.JSXOpeningElement['attributes'],
      stripNames?: Set<string>,
      renameNames?: Map<string, string>
    ) {
      return attributes
        .filter(attr => {
          if (!stripNames) {
            return true;
          }
          return !(
            attr.type === 'JSXAttribute' &&
            attr.name.type === 'JSXIdentifier' &&
            stripNames.has(attr.name.name)
          );
        })
        .map(attr => {
          if (attr.type === 'JSXAttribute' && attr.name.type === 'JSXIdentifier') {
            return renameNames?.get(attr.name.name) ?? context.sourceCode.getText(attr);
          }
          return context.sourceCode.getText(attr);
        })
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
                        const isOverflowOnly = node.openingElement.attributes.some(
                          attr =>
                            attr.type === 'JSXAttribute' &&
                            attr.name.type === 'JSXIdentifier' &&
                            attr.name.name === 'showOnlyOnOverflow'
                        );
                        const textPropsToStrip = isOverflowOnly
                          ? new Set([
                              ...TEXT_PROPS_TO_STRIP,
                              ...TEXT_PROPS_TO_STRIP_IN_OVERFLOW_ONLY,
                            ])
                          : TEXT_PROPS_TO_STRIP;
                        const attributes = [
                          getAttributeText(
                            node.openingElement.attributes,
                            TOOLTIP_PROPS_TO_STRIP,
                            TOOLTIP_PROPS_TO_RENAME
                          ),
                          getAttributeText(
                            textChild.openingElement.attributes,
                            textPropsToStrip
                          ),
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

                      const fixes: Fix[] = [
                        fixer.replaceText(node.openingElement.name, infoTextName),
                        fixer.replaceText(node.closingElement.name, infoTextName),
                        fixer.insertTextAfter(
                          node.openingElement.name,
                          ' variant="inherit"'
                        ),
                      ];
                      for (const attr of node.openingElement.attributes) {
                        if (attr.type !== 'JSXAttribute') {
                          continue;
                        }

                        if (attr.name.type !== 'JSXIdentifier') {
                          continue;
                        }

                        const replacement = TOOLTIP_PROPS_TO_RENAME.get(attr.name.name);
                        if (replacement !== undefined) {
                          fixes.push(fixer.replaceText(attr, replacement));
                        } else if (TOOLTIP_PROPS_TO_STRIP.has(attr.name.name)) {
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
