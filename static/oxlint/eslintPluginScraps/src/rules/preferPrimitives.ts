import {defineRule, type ESTree, type Variable} from '@oxlint/plugins';

import {parseCssTemplate} from '../ast/extractor/css.ts';
import {createImportTracker} from '../ast/tracker/imports.ts';
import {normalizePropertyName} from '../ast/utils/normalizePropertyName.ts';
import {getStyledCallInfo} from '../ast/utils/styled.ts';

const CONTAINER_PROPERTIES = new Set([
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-radius',
  'background-color',
]);
const LAYOUT_ELEMENTS = new Set([
  'article',
  'aside',
  'blockquote',
  'div',
  'fieldset',
  'figure',
  'footer',
  'header',
  'label',
  'li',
  'main',
  'nav',
  'ol',
  'section',
  'span',
  'summary',
  'td',
  'th',
  'ul',
  'hr',
]);
const TEXT_ELEMENTS = new Set(['span', 'p', 'label', 'div', 'time', 'legend']);
const TEXT_PROPERTIES: Record<string, readonly string[] | null> = {
  'font-size': null,
  'font-weight': ['400', '500'],
  'font-family': ['monospace'],
  'font-variant-numeric': ['tabular-nums', 'diagonal-fractions'],
  'text-overflow': ['ellipsis'],
  'line-height': null,
  color: null,
  'text-align': ['left', 'center', 'right', 'justify'],
  'font-style': ['italic'],
  'text-transform': ['uppercase'],
  'text-decoration': ['underline', 'line-through'],
  'white-space': ['nowrap', 'normal', 'pre', 'pre-line', 'pre-wrap'],
  'text-wrap': ['wrap', 'nowrap', 'balance', 'pretty', 'stable'],
  'word-break': ['normal', 'break-all', 'keep-all', 'break-word'],
};
const IMPORTS = {
  Button: '@sentry/scraps/button',
  Container: '@sentry/scraps/layout',
  Flex: '@sentry/scraps/layout',
  Grid: '@sentry/scraps/layout',
  Heading: '@sentry/scraps/text',
  Stack: '@sentry/scraps/layout',
  Text: '@sentry/scraps/text',
};
type Primitive = keyof typeof IMPORTS;
type Declarations = Map<string, string | null>;

function elementPrimitive(element: string): Primitive | undefined {
  if (element === 'button') {
    return 'Button';
  }
  if (/^h[1-6]$/.test(element)) {
    return 'Heading';
  }
  return undefined;
}

function stylePrimitive(
  declarations: Declarations,
  elements: Set<string>
): Primitive | undefined {
  if (declarations.has('all')) {
    return undefined;
  }
  const supportsLayout = [...elements].every(element => LAYOUT_ELEMENTS.has(element));
  const display = declarations.get('display');
  if (display === 'flex' || display === 'inline-flex') {
    if (!supportsLayout) {
      return undefined;
    }
    return declarations.get('flex-direction') === 'column' ? 'Stack' : 'Flex';
  }
  if (display === 'grid' || display === 'inline-grid') {
    return supportsLayout ? 'Grid' : undefined;
  }
  if (
    [...elements].every(element => TEXT_ELEMENTS.has(element)) &&
    [...declarations].filter(([property, value]) => {
      const supported = Object.hasOwn(TEXT_PROPERTIES, property)
        ? TEXT_PROPERTIES[property]
        : undefined;
      return supported === null || (value !== null && supported?.includes(value));
    }).length >= 2
  ) {
    return 'Text';
  }
  if (
    supportsLayout &&
    [...declarations.keys()].filter(property => CONTAINER_PROPERTIES.has(property))
      .length >= 2
  ) {
    return 'Container';
  }
  return undefined;
}

function staticValue(node: ESTree.Node): string | null {
  if (
    node.type === 'Literal' &&
    (typeof node.value === 'string' || typeof node.value === 'number')
  ) {
    return String(node.value).trim().toLowerCase();
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked?.trim().toLowerCase() ?? null;
  }
  return null;
}

export const preferPrimitives = defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Prefer current Scraps primitives at intrinsic Emotion and JSX style sites.',
    },
    schema: [],
    messages: {
      preferPrimitive:
        "Use {{primitive}} from '{{source}}'. Migrate supported styles to primitive props and theme tokens; preserve the element and behavior.",
      preferButton:
        "Use Button from '@sentry/scraps/button'. Preserve form behavior explicitly: Button defaults to type='button', while native buttons may submit.",
      preferHeading:
        "Use Heading from '@sentry/scraps/text' with as='{{element}}' to preserve the heading level. Choose size and typography tokens explicitly.",
    },
  },
  create(context) {
    const importTracker = createImportTracker(context);
    const styles = new Map<
      ESTree.Node,
      {declarations: Declarations; elements: Set<string>}
    >();

    function imported(node: ESTree.Node, source: string, name: string): boolean {
      return importTracker.is(node, source, name);
    }

    function isCss(node: ESTree.Node): boolean {
      return (
        imported(node, '@emotion/react', 'css') ||
        (node.type === 'MemberExpression' &&
          !node.computed &&
          node.property.type === 'Identifier' &&
          node.property.name === 'css' &&
          imported(node.object, '@emotion/react', '*'))
      );
    }

    function report(node: ESTree.Node, primitive: Primitive, element?: string) {
      context.report({
        node,
        messageId:
          primitive === 'Button'
            ? 'preferButton'
            : primitive === 'Heading'
              ? 'preferHeading'
              : 'preferPrimitive',
        data: {primitive, source: IMPORTS[primitive], element: element ?? ''},
      });
    }

    function templateDeclarations(template: ESTree.TemplateLiteral): Declarations | null {
      const declarations = parseCssTemplate(
        template,
        context.sourceCode.getText(template)
      )?.filter(declaration => declaration.root);
      if (!declarations) {
        return null;
      }
      if (declarations.some(declaration => declaration.important)) {
        return null;
      }
      if (
        template.expressions.some(
          expression =>
            !declarations.some(declaration =>
              declaration.interpolations.some(item => item.expression === expression)
            )
        )
      ) {
        return null;
      }
      return new Map(
        declarations.map(declaration => [
          declaration.name,
          declaration.value.trim().toLowerCase(),
        ])
      );
    }

    function safeBinding(binding: Variable, seen = new Set<Variable>()): boolean {
      if (seen.has(binding)) {
        return true;
      }
      seen.add(binding);
      const definition = binding.defs[0];
      if (
        definition?.parent?.type !== 'VariableDeclaration' ||
        definition.parent.kind !== 'const'
      ) {
        return false;
      }
      return binding.references.every(reference => {
        if (reference.init) {
          return true;
        }
        let node: ESTree.Node = reference.identifier;
        while (
          node.parent?.type === 'TSAsExpression' ||
          node.parent?.type === 'TSSatisfiesExpression' ||
          node.parent?.type === 'TSNonNullExpression'
        ) {
          node = node.parent;
        }
        const parent = node.parent;
        if (
          parent?.type === 'VariableDeclarator' &&
          parent.init === node &&
          parent.id.type === 'Identifier'
        ) {
          const alias = importTracker.resolveVariable(parent.id);
          return alias !== undefined && safeBinding(alias, seen);
        }
        if (
          parent?.type === 'CallExpression' &&
          parent.arguments.length === 1 &&
          parent.arguments[0] === node
        ) {
          const kind = getStyledCallInfo(parent, importTracker)?.kind;
          return kind === 'css' || kind === 'element';
        }
        if (
          parent?.type === 'JSXExpressionContainer' &&
          parent.parent?.type === 'JSXAttribute'
        ) {
          const attribute = parent.parent;
          const element = attribute.parent;
          return (
            attribute.name.type === 'JSXIdentifier' &&
            ['css', 'style'].includes(attribute.name.name) &&
            element?.type === 'JSXOpeningElement' &&
            element.name.type === 'JSXIdentifier' &&
            /^[a-z]/.test(element.name.name)
          );
        }
        return false;
      });
    }

    function addStyle(node: ESTree.Node, element: string, seen = new Set<ESTree.Node>()) {
      if (seen.has(node)) {
        return;
      }
      seen.add(node);
      if (
        node.type === 'TSAsExpression' ||
        node.type === 'TSSatisfiesExpression' ||
        node.type === 'TSNonNullExpression' ||
        node.type === 'TSTypeAssertion'
      ) {
        addStyle(node.expression, element, seen);
        return;
      }
      if (node.type === 'Identifier') {
        const binding = importTracker.resolveVariable(node);
        const definition = binding?.defs[0];
        if (
          definition?.node.type === 'VariableDeclarator' &&
          definition.parent?.type === 'VariableDeclaration' &&
          definition.parent.kind === 'const' &&
          definition.node.init &&
          binding !== undefined &&
          safeBinding(binding)
        ) {
          addStyle(definition.node.init, element, seen);
        }
        return;
      }
      if (
        node.type === 'ArrowFunctionExpression' &&
        node.body.type !== 'BlockStatement'
      ) {
        addStyle(node.body, element, seen);
        return;
      }
      if (
        node.type === 'CallExpression' &&
        isCss(node.callee) &&
        node.arguments.length === 1 &&
        node.arguments[0]
      ) {
        addStyle(node.arguments[0], element, seen);
        return;
      }
      let declarations: Declarations | null = null;
      if (node.type === 'ObjectExpression') {
        declarations = new Map();
        for (const property of node.properties) {
          if (
            property.type !== 'Property' ||
            property.computed ||
            property.kind !== 'init' ||
            property.method
          ) {
            return;
          }
          const name =
            property.key.type === 'Identifier'
              ? property.key.name
              : property.key.type === 'Literal' && typeof property.key.value === 'string'
                ? property.key.value
                : null;
          if (name !== null) {
            declarations.set(normalizePropertyName(name), staticValue(property.value));
          }
        }
      } else if (node.type === 'TaggedTemplateExpression' && isCss(node.tag)) {
        declarations = templateDeclarations(node.quasi);
      } else if (node.type === 'TemplateLiteral') {
        declarations = templateDeclarations(node);
      }
      if (declarations) {
        const prior = styles.get(node);
        if (prior) {
          prior.elements.add(element);
        } else {
          styles.set(node, {declarations, elements: new Set([element])});
        }
      }
    }

    return {
      ...importTracker.visitors,
      TaggedTemplateExpression(node) {
        const styled = getStyledCallInfo(node, importTracker);
        if (styled?.kind !== 'element') {
          return;
        }
        const element = styled.name;
        const primitive = elementPrimitive(element);
        if (primitive) {
          report(node, primitive, element);
        } else {
          addStyle(node.quasi, element);
        }
      },
      CallExpression(node) {
        const styled = getStyledCallInfo(node, importTracker);
        if (styled?.kind !== 'element') {
          return;
        }
        const element = styled.name;
        const primitive = elementPrimitive(element);
        if (primitive) {
          report(node, primitive, element);
        } else if (node.arguments.length === 1 && node.arguments[0]) {
          addStyle(node.arguments[0], element);
        }
      },
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier' || !/^[a-z]/.test(node.name.name)) {
          return;
        }
        const element = node.name.name;
        const primitive = elementPrimitive(element);
        if (primitive) {
          report(node.name, primitive, element);
          return;
        }
        const styleAttributes = node.attributes.filter(
          attribute =>
            attribute.type === 'JSXAttribute' &&
            attribute.name.type === 'JSXIdentifier' &&
            ['css', 'style'].includes(attribute.name.name)
        );
        if (
          styleAttributes.length !== 1 ||
          node.attributes.some(attribute => attribute.type === 'JSXSpreadAttribute')
        ) {
          return;
        }
        for (const attribute of styleAttributes) {
          if (
            attribute.type === 'JSXAttribute' &&
            attribute.name.type === 'JSXIdentifier' &&
            ['css', 'style'].includes(attribute.name.name) &&
            attribute.value?.type === 'JSXExpressionContainer'
          ) {
            addStyle(attribute.value.expression, element);
          }
        }
      },
      'Program:exit'() {
        for (const [node, {declarations, elements}] of styles) {
          const primitive = stylePrimitive(declarations, elements);
          if (primitive) {
            report(node, primitive);
          }
        }
      },
    };
  },
});
