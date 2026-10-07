// oxlint-disable-next-line import/no-nodejs-modules -- CSS parsing runs in oxlint's Node plugin host.
import {createRequire} from 'node:module';

import {defineRule, type ESTree, type Scope, type Variable} from '@oxlint/plugins';

import {normalizePropertyName} from '../ast/utils/normalizePropertyName.ts';

type CssNode = {
  type: string;
  important?: boolean;
  nodes?: CssNode[];
  prop?: string;
  raws?: {between?: string};
  source?: {end?: {offset?: number}; start?: {offset?: number}};
  value?: string;
};
type CssDocument = {nodes: CssNode[]};
type CssParser = {parse: (source: string, options: {from: string}) => CssDocument};
type CssDeclaration = {
  important: boolean;
  interpolations: ESTree.Expression[];
  name: string;
  value: string;
};

const styledSyntax: CssParser = createRequire(import.meta.url)('postcss-styled-syntax');
const CSS_PREFIX = 'styled.div';

function valueStart(node: CssNode, source: string): number | undefined {
  const start = node.source?.start?.offset;
  if (start === undefined || node.prop === undefined) {
    return undefined;
  }
  const propertyEnd = start + node.prop.length;
  if (node.raws?.between) {
    return propertyEnd + node.raws.between.length;
  }
  const colon = source.indexOf(':', propertyEnd);
  return colon === -1 ? undefined : colon + 1;
}

function parseCss(source: string): CssDocument | null {
  try {
    return styledSyntax.parse(source, {from: 'style.tsx'});
  } catch (error) {
    if (error instanceof Error && error.name === 'CssSyntaxError') {
      return null;
    }
    throw error;
  }
}

function parseCssTemplate(
  template: ESTree.TemplateLiteral,
  source: string
): CssDeclaration[] | null {
  const parsedSource = `${CSS_PREFIX}${source}`;
  const root = parseCss(parsedSource)?.nodes[0];
  if (!root) {
    return null;
  }

  const offset = (position: number) => position - template.range[0] + CSS_PREFIX.length;
  return (root.nodes ?? []).flatMap(node => {
    if (node.type !== 'decl' || node.prop === undefined || node.value === undefined) {
      return [];
    }
    const start = valueStart(node, parsedSource);
    const end = node.source?.end?.offset;
    return [
      {
        important: node.important ?? false,
        interpolations:
          start === undefined || end === undefined
            ? []
            : template.expressions.filter(
                expression =>
                  start <= offset(expression.range[0]) &&
                  end >= offset(expression.range[1])
              ),
        name: normalizePropertyName(node.prop),
        value: node.value,
      },
    ];
  });
}

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
const TEXT_PROPERTIES = new Map<string, readonly string[] | null>([
  ['font-size', null],
  ['font-weight', ['400', '500']],
  ['font-family', ['monospace']],
  ['font-variant-numeric', ['tabular-nums', 'diagonal-fractions']],
  ['text-overflow', ['ellipsis']],
  ['line-height', null],
  ['color', null],
  ['text-align', ['left', 'center', 'right', 'justify']],
  ['font-style', ['italic']],
  ['text-transform', ['uppercase']],
  ['text-decoration', ['underline', 'line-through']],
  ['white-space', ['nowrap', 'normal', 'pre', 'pre-line', 'pre-wrap']],
  ['text-wrap', ['wrap', 'nowrap', 'balance', 'pretty', 'stable']],
  ['word-break', ['normal', 'break-all', 'keep-all', 'break-word']],
]);
const STYLE_ATTRIBUTES = new Set(['css', 'style']);
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

function isIntrinsic(name: string): boolean {
  return /^[a-z]/.test(name);
}

function elementName(name: string): string | null {
  return !name.includes('.') && isIntrinsic(name) ? name : null;
}

function isTypeWrapper(
  node: ESTree.Node
): node is
  | ESTree.TSAsExpression
  | ESTree.TSSatisfiesExpression
  | ESTree.TSNonNullExpression
  | ESTree.TSTypeAssertion {
  return (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSTypeAssertion'
  );
}

function outermostTypeWrapper(node: ESTree.Node): ESTree.Node {
  return node.parent && isTypeWrapper(node.parent)
    ? outermostTypeWrapper(node.parent)
    : node;
}

function findVariable(scope: Scope | null, name: string): Variable | undefined {
  return scope ? (scope.set.get(name) ?? findVariable(scope.upper, name)) : undefined;
}

function isStyleAttribute(
  attribute: ESTree.JSXAttributeItem
): attribute is ESTree.JSXAttribute {
  return (
    attribute.type === 'JSXAttribute' &&
    attribute.name.type === 'JSXIdentifier' &&
    STYLE_ATTRIBUTES.has(attribute.name.name)
  );
}

function jsxStyle(attributes: ESTree.JSXAttributeItem[]): ESTree.Node | undefined {
  for (const [index, attribute] of attributes.entries()) {
    if (attribute.type === 'JSXSpreadAttribute') {
      return undefined;
    }
    if (isStyleAttribute(attribute)) {
      const overridden = attributes
        .slice(index + 1)
        .some(other => other.type === 'JSXSpreadAttribute' || isStyleAttribute(other));
      return !overridden && attribute.value?.type === 'JSXExpressionContainer'
        ? attribute.value.expression
        : undefined;
    }
  }
  return undefined;
}

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
  const tags = [...elements];
  const supportsLayout = tags.every(element => LAYOUT_ELEMENTS.has(element));
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
    tags.every(element => TEXT_ELEMENTS.has(element)) &&
    [...declarations].filter(([property, value]) => {
      const supported = TEXT_PROPERTIES.get(property);
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

function objectDeclarations(node: ESTree.ObjectExpression): Declarations | null {
  const declarations: Declarations = new Map();
  for (const property of node.properties) {
    if (
      property.type !== 'Property' ||
      property.computed ||
      property.kind !== 'init' ||
      property.method
    ) {
      return null;
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
  return declarations;
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
    const styles = new Map<
      ESTree.Node,
      {declarations: Declarations; elements: Set<string>}
    >();

    function resolveVariable(node: ESTree.Node): Variable | undefined {
      return node.type === 'Identifier'
        ? findVariable(context.sourceCode.getScope(node), node.name)
        : undefined;
    }

    function imported(node: ESTree.Node, source: string, name: string): boolean {
      if (
        node.type === 'MemberExpression' &&
        !node.computed &&
        node.property.type === 'Identifier' &&
        node.property.name === name
      ) {
        return imported(node.object, source, '*');
      }
      const definition = resolveVariable(node)?.defs[0];
      if (
        definition?.type !== 'ImportBinding' ||
        definition.parent?.type !== 'ImportDeclaration' ||
        definition.parent.importKind === 'type' ||
        (definition.node.type === 'ImportSpecifier' &&
          definition.node.importKind === 'type') ||
        definition.parent.source.value !== source
      ) {
        return false;
      }
      const specifier = definition.node;
      if (specifier.type === 'ImportDefaultSpecifier') {
        return name === 'default';
      }
      if (specifier.type === 'ImportNamespaceSpecifier') {
        return name === '*';
      }
      return (
        specifier.type === 'ImportSpecifier' &&
        (specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value) === name
      );
    }

    function isCss(node: ESTree.Node): boolean {
      return imported(node, '@emotion/react', 'css');
    }

    function styledArgument(arg: ESTree.Argument | undefined): string | null {
      if (arg?.type === 'Literal' && typeof arg.value === 'string') {
        return elementName(arg.value);
      }
      return arg?.type === 'Identifier' ? elementName(arg.name) : null;
    }

    function styledElement(node: ESTree.Node): string | null {
      if (
        node.type === 'MemberExpression' &&
        imported(node.object, '@emotion/styled', 'default') &&
        node.property.type === 'Identifier'
      ) {
        return elementName(node.property.name);
      }
      if (
        node.type === 'CallExpression' &&
        imported(node.callee, '@emotion/styled', 'default')
      ) {
        return styledArgument(node.arguments[0]);
      }
      return null;
    }

    function styleKind(
      node: ESTree.TaggedTemplateExpression | ESTree.CallExpression
    ): {kind: 'css'} | {kind: 'element'; name: string} | null {
      if (node.type === 'CallExpression') {
        const {parent} = node;
        if (
          (parent?.type === 'TaggedTemplateExpression' && parent.tag === node) ||
          (parent?.type === 'CallExpression' && parent.callee === node) ||
          (parent?.type === 'MemberExpression' && parent.object === node)
        ) {
          return null;
        }
      }
      const tag = node.type === 'TaggedTemplateExpression' ? node.tag : node.callee;
      if (isCss(tag)) {
        return {kind: 'css'};
      }
      const name = styledElement(tag) ?? styledElement(node);
      return name ? {kind: 'element', name} : null;
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
      );
      if (
        !declarations ||
        declarations.some(declaration => declaration.important) ||
        template.expressions.some(
          expression =>
            !declarations.some(declaration =>
              declaration.interpolations.includes(expression)
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

    function styleDeclarations(node: ESTree.Node): Declarations | null {
      if (node.type === 'ObjectExpression') {
        return objectDeclarations(node);
      }
      if (node.type === 'TaggedTemplateExpression' && isCss(node.tag)) {
        return templateDeclarations(node.quasi);
      }
      if (node.type === 'TemplateLiteral') {
        return templateDeclarations(node);
      }
      return null;
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
        const node = outermostTypeWrapper(reference.identifier);
        const parent = node.parent;
        if (
          parent?.type === 'VariableDeclarator' &&
          parent.init === node &&
          parent.id.type === 'Identifier'
        ) {
          const alias = resolveVariable(parent.id);
          return alias !== undefined && safeBinding(alias, seen);
        }
        if (
          parent?.type === 'CallExpression' &&
          parent.arguments.length === 1 &&
          parent.arguments[0] === node
        ) {
          return styleKind(parent) !== null;
        }
        if (
          parent?.type === 'JSXExpressionContainer' &&
          parent.parent?.type === 'JSXAttribute'
        ) {
          const attribute = parent.parent;
          const element = attribute.parent;
          return (
            isStyleAttribute(attribute) &&
            element?.type === 'JSXOpeningElement' &&
            element.name.type === 'JSXIdentifier' &&
            isIntrinsic(element.name.name)
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
      if (isTypeWrapper(node)) {
        addStyle(node.expression, element, seen);
        return;
      }
      if (node.type === 'Identifier') {
        const binding = resolveVariable(node);
        const definition = binding?.defs[0];
        if (
          binding &&
          definition?.node.type === 'VariableDeclarator' &&
          definition.node.id.type === 'Identifier' &&
          definition.node.init &&
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
      const declarations = styleDeclarations(node);
      if (!declarations) {
        return;
      }
      const prior = styles.get(node);
      if (prior) {
        prior.elements.add(element);
      } else {
        styles.set(node, {declarations, elements: new Set([element])});
      }
    }

    function checkStyled(
      node: ESTree.TaggedTemplateExpression | ESTree.CallExpression,
      style: ESTree.Node | undefined
    ) {
      const styled = styleKind(node);
      if (styled?.kind !== 'element') {
        return;
      }
      const primitive = elementPrimitive(styled.name);
      if (primitive) {
        report(node, primitive, styled.name);
      } else if (style) {
        addStyle(style, styled.name);
      }
    }

    return {
      TaggedTemplateExpression(node) {
        checkStyled(node, node.quasi);
      },
      CallExpression(node) {
        checkStyled(node, node.arguments.length === 1 ? node.arguments[0] : undefined);
      },
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier' || !isIntrinsic(node.name.name)) {
          return;
        }
        const element = node.name.name;
        const primitive = elementPrimitive(element);
        if (primitive) {
          report(node.name, primitive, element);
          return;
        }
        const style = jsxStyle(node.attributes);
        if (style) {
          addStyle(style, element);
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
