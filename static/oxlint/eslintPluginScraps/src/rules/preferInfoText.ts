import {type Fix, type Fixer, defineRule, type ESTree} from '@oxlint/plugins';

import {createImportTracker} from '../ast/tracker/imports.ts';
import {removeJsxAttributes} from '../ast/utils/removeJsxAttributes.ts';

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
]);
const TOOLTIP_PROPS_TO_STRIP = new Set(['showUnderline', 'isHoverable', 'skipWrapper']);
const TOOLTIP_PROPS_TO_RENAME = new Map([['showOnlyOnOverflow', 'mode="overflowOnly"']]);
const TEXT_PROPS_TO_STRIP = new Set(['underline']);
const TEXT_PROPS_TO_STRIP_IN_OVERFLOW_ONLY = new Set(['ellipsis']);

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
    const importTracker = createImportTracker(context);
    const resolvingConstants = new Set<ESTree.VariableDeclarator>();

    function getConstantDeclarator(node: ESTree.IdentifierReference) {
      const definition = importTracker.resolveVariable(node)?.defs[0];
      if (
        definition?.parent?.type !== 'VariableDeclaration' ||
        definition.parent.kind !== 'const' ||
        definition.node.type !== 'VariableDeclarator' ||
        definition.node.id.type !== 'Identifier'
      ) {
        return null;
      }
      return definition.node;
    }

    function isTextLikeExpression(
      expr: ESTree.Expression,
      resolveConstants = true
    ): boolean {
      switch (expr.type) {
        case 'Identifier': {
          if (!resolveConstants) {
            return false;
          }
          const declarator = getConstantDeclarator(expr);
          if (!declarator?.init || resolvingConstants.has(declarator)) {
            return false;
          }
          resolvingConstants.add(declarator);
          try {
            return isTextLikeExpression(declarator.init);
          } finally {
            resolvingConstants.delete(declarator);
          }
        }
        case 'JSXElement':
        case 'JSXFragment':
          return isTextLikeChild(expr, resolveConstants);
        case 'Literal':
          return typeof expr.value === 'string';
        case 'TemplateLiteral':
          return true;
        case 'CallExpression':
          return importTracker.resolve(expr.callee)?.source === LOCALE_SOURCE;
        case 'ConditionalExpression':
          return (
            isTextLikeExpression(expr.consequent, resolveConstants) &&
            isTextLikeExpression(expr.alternate, resolveConstants)
          );
        case 'LogicalExpression':
          if (expr.operator === '&&') {
            return isTextLikeExpression(expr.right, resolveConstants);
          }
          return (
            isTextLikeExpression(expr.left, resolveConstants) &&
            isTextLikeExpression(expr.right, resolveConstants)
          );
        default:
          return false;
      }
    }

    function isTextLikeChild(child: ESTree.JSXChild, resolveConstants = true): boolean {
      switch (child.type) {
        case 'JSXText':
          return child.value.trim().length > 0;
        case 'JSXExpressionContainer':
          if (child.expression.type === 'JSXEmptyExpression') {
            return false;
          }
          return isTextLikeExpression(child.expression, resolveConstants);
        case 'JSXElement': {
          const {name} = child.openingElement;
          // Text is intended to render text content, so do not require the
          // expression inside it to be statically recognizable as text.
          if (importTracker.is(child.openingElement.name, TEXT_SOURCE, 'Text')) {
            return true;
          }
          if (name.type === 'JSXIdentifier' && TEXT_LIKE_INTRINSICS.has(name.name)) {
            return allChildrenAreTextLike(child.children, resolveConstants);
          }
          return false;
        }
        case 'JSXFragment':
          return allChildrenAreTextLike(child.children, resolveConstants);
        default:
          return false;
      }
    }

    function allChildrenAreTextLike(
      children: ESTree.JSXChild[],
      resolveConstants = true
    ): boolean {
      const meaningful = getMeaningfulChildren(children);
      return (
        meaningful.length > 0 &&
        meaningful.every(child => isTextLikeChild(child, resolveConstants))
      );
    }

    function getMeaningfulChildren(children: ESTree.JSXChild[]) {
      return children.filter(
        child => !(child.type === 'JSXText' && child.value.trim() === '')
      );
    }

    function getSingleTextElementChild(node: ESTree.JSXElement) {
      const meaningfulChildren = getMeaningfulChildren(node.children);
      const child = meaningfulChildren[0];
      if (
        meaningfulChildren.length !== 1 ||
        child?.type !== 'JSXElement' ||
        !importTracker.is(child.openingElement.name, TEXT_SOURCE, 'Text')
      ) {
        return null;
      }

      return child;
    }

    function canSuggestInfoText(node: ESTree.JSXElement): boolean {
      // Keep suggestions limited to content directly inside the Tooltip.
      // A referenced element can also be used elsewhere and needs a manual change.
      if (!allChildrenAreTextLike(node.children, false)) {
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

    function getInfoTextFixes(fixer: Fixer) {
      const [existingName] = importTracker.findLocalNames(INFO_SOURCE, 'InfoText');
      if (existingName) {
        return {infoTextName: existingName, importFixes: []};
      }
      const lastImport = context.sourceCode.ast.body.findLast(
        node => node.type === 'ImportDeclaration'
      );
      return {
        infoTextName: 'InfoText',
        importFixes: lastImport
          ? [
              fixer.insertTextAfter(
                lastImport,
                `\nimport {InfoText} from '${INFO_SOURCE}';\n`
              ),
            ]
          : [],
      };
    }

    function getAttributeText(
      attributes: ESTree.JSXOpeningElement['attributes'],
      stripNames: Set<string>,
      renameNames?: Map<string, string>
    ) {
      return attributes
        .filter(
          attr =>
            !(
              attr.type === 'JSXAttribute' &&
              attr.name.type === 'JSXIdentifier' &&
              stripNames.has(attr.name.name)
            )
        )
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
      JSXElement(node) {
        if (!importTracker.is(node.openingElement.name, TOOLTIP_SOURCE, 'Tooltip')) {
          return;
        }
        if (allChildrenAreTextLike(node.children)) {
          context.report({
            node: node.openingElement,
            messageId: 'preferInfoText',
            suggest: canSuggestInfoText(node)
              ? [
                  {
                    messageId: 'replaceWithInfoText',
                    fix(fixer) {
                      if (!node.closingElement) {
                        return null;
                      }
                      const {infoTextName, importFixes} = getInfoTextFixes(fixer);
                      const textChild = getSingleTextElementChild(node);
                      const childrenRange: [number, number] | null =
                        textChild?.closingElement
                          ? [
                              textChild.openingElement.range[1],
                              textChild.closingElement.range[0],
                            ]
                          : null;
                      if (
                        textChild &&
                        childrenRange &&
                        context.sourceCode
                          .getCommentsInside(node)
                          .every(
                            comment =>
                              comment.range[0] >= childrenRange[0] &&
                              comment.range[1] <= childrenRange[1]
                          )
                      ) {
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
                          childrenRange[0],
                          childrenRange[1]
                        );
                        const replacement = `${buildOpeningTag(
                          infoTextName,
                          attributes
                        )}${childrenText}</${infoTextName}>`;
                        return [fixer.replaceText(node, replacement), ...importFixes];
                      }

                      const fixes: Fix[] = [
                        ...importFixes,
                        fixer.replaceText(node.openingElement.name, infoTextName),
                        fixer.replaceText(node.closingElement.name, infoTextName),
                        fixer.insertTextAfter(
                          node.openingElement.name,
                          ' variant="inherit"'
                        ),
                      ];
                      let strippedRun: ESTree.JSXAttribute[] = [];
                      const flushStrippedRun = () => {
                        const [first] = strippedRun;
                        if (first) {
                          fixes.push(
                            removeJsxAttributes(
                              fixer,
                              context.sourceCode,
                              first,
                              strippedRun.at(-1)
                            )
                          );
                        }
                        strippedRun = [];
                      };
                      for (const attr of node.openingElement.attributes) {
                        if (
                          attr.type === 'JSXAttribute' &&
                          attr.name.type === 'JSXIdentifier' &&
                          TOOLTIP_PROPS_TO_STRIP.has(attr.name.name)
                        ) {
                          const previous = strippedRun.at(-1);
                          if (
                            previous &&
                            context.sourceCode.getTokenBefore(attr, {
                              includeComments: true,
                            })?.range[1] !== previous.range[1]
                          ) {
                            flushStrippedRun();
                          }
                          strippedRun.push(attr);
                          continue;
                        }
                        flushStrippedRun();
                        if (
                          attr.type !== 'JSXAttribute' ||
                          attr.name.type !== 'JSXIdentifier'
                        ) {
                          continue;
                        }
                        const replacement = TOOLTIP_PROPS_TO_RENAME.get(attr.name.name);
                        if (replacement !== undefined) {
                          fixes.push(fixer.replaceText(attr, replacement));
                        }
                      }
                      flushStrippedRun();
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
