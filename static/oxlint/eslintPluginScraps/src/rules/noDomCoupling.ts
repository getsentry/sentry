import {defineRule, type ESTree} from '@oxlint/plugins';

import {
  cookCssTemplateText,
  isDisabledByDirectives,
  parseCssTemplate,
  type ParsedCssSelector,
} from '../ast/extractor/css.ts';
import {createImportTracker} from '../ast/tracker/imports.ts';
import {hasDomCoupling} from '../ast/utils/selectors.ts';
import {getStyledCallInfo} from '../ast/utils/styled.ts';
import {unwrapTypeWrappers} from '../ast/utils/typeWrappers.ts';

const CONSTANT_CASE = /^[A-Z][A-Z\d_]+$/;
const STYLE_TYPE_SOURCES = new Set([
  '@emotion/react',
  '@emotion/serialize',
  '@sentry/scraps/select',
  '@sentry/scraps/theme',
]);
const STYLE_TYPES = new Map([
  ['CSSObject', 'css'],
  ['StrictCSSObject', 'css'],
  ['StylesConfig', 'config'],
]);

function getStatementReturns(node: ESTree.Node): ESTree.Node[] {
  if (node.type === 'ReturnStatement') {
    return node.argument ? [node.argument] : [];
  }
  if (node.type === 'BlockStatement') {
    return node.body.flatMap(getStatementReturns);
  }
  if (node.type === 'SwitchStatement') {
    return node.cases.flatMap(switchCase =>
      switchCase.consequent.flatMap(getStatementReturns)
    );
  }
  if (node.type === 'IfStatement') {
    return [
      ...getStatementReturns(node.consequent),
      ...(node.alternate ? getStatementReturns(node.alternate) : []),
    ];
  }
  return [];
}

function getFunctionReturns(node: ESTree.Node) {
  if (
    node.type !== 'ArrowFunctionExpression' &&
    node.type !== 'FunctionExpression' &&
    node.type !== 'FunctionDeclaration'
  ) {
    return;
  }
  if (!node.body) {
    return [];
  }
  return node.body.type === 'BlockStatement'
    ? getStatementReturns(node.body)
    : [node.body];
}

function combine(prefixes: string[], suffixes: string[]) {
  return [
    ...new Set(prefixes.flatMap(prefix => suffixes.map(suffix => prefix + suffix))),
  ];
}

export const noDomCoupling = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow selectors that depend on component or DOM structure',
    },
    schema: [],
    messages: {
      forbidden:
        'Do not select components, DOM elements, universal targets, or unscoped children. Use an explicit class, ID, or attribute target instead.',
    },
  },
  create(context) {
    const imports = createImportTracker(context);
    const visited = new Set<ESTree.Node>();

    function binding(node: ESTree.Node): ESTree.Node | undefined {
      if (node.type === 'MemberExpression') {
        const object = binding(node.object);
        const name = node.computed
          ? stringValue(node.property)
          : node.property.type === 'Identifier'
            ? node.property.name
            : null;
        if (object?.type === 'ObjectExpression' && name !== null) {
          const found = object.properties.find(
            property => property.type === 'Property' && getPropertyName(property) === name
          );
          return found?.type === 'Property' ? found.value : undefined;
        }
        return undefined;
      }
      const variableDefinition = imports.resolveVariable(node)?.defs[0];
      const definition = variableDefinition?.node;
      if (definition?.type === 'VariableDeclarator') {
        return definition.init ?? undefined;
      }
      return variableDefinition?.type === 'FunctionName' &&
        definition?.type === 'FunctionDeclaration'
        ? definition
        : undefined;
    }

    function getPropertyName({computed, key}: ESTree.ObjectProperty) {
      return !computed && key.type === 'Identifier' ? key.name : stringValue(key);
    }

    function stringValue(
      node: ESTree.Node,
      seen = new Set<ESTree.Node>()
    ): string | null {
      node = unwrapTypeWrappers(node);
      if (seen.has(node)) {
        return null;
      }
      seen.add(node);
      if (node.type === 'Literal' && typeof node.value === 'string') {
        return node.value;
      }
      if (node.type === 'Identifier') {
        const value = binding(node);
        return value ? stringValue(value, seen) : null;
      }
      if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
        return node.quasis[0]?.value.cooked ?? null;
      }
      return null;
    }

    function interpolation(
      expression: ESTree.Node,
      suffix: string,
      seen = new Set<ESTree.Node>()
    ): string[] {
      expression = unwrapTypeWrappers(expression);
      if (seen.has(expression)) {
        return [''];
      }
      seen = new Set(seen).add(expression);
      const resolve = (node: ESTree.Node) => interpolation(node, suffix, seen);
      const value = stringValue(expression);
      if (value !== null) {
        return [
          suffix.trim() && value.includes(';') && !/^[.#[]/.test(value.trim())
            ? ''
            : value,
        ];
      }
      const fragment = binding(expression);
      if (fragment) {
        return resolve(fragment);
      }
      if (expression.type === 'ConditionalExpression') {
        return [...resolve(expression.consequent), ...resolve(expression.alternate)];
      }
      if (expression.type === 'LogicalExpression') {
        return expression.operator === '&&'
          ? ['', ...resolve(expression.right)]
          : [...resolve(expression.left), ...resolve(expression.right)];
      }
      if (expression.type === 'TemplateLiteral') {
        let values = [''];
        for (const [index, quasi] of expression.quasis.entries()) {
          values = values.map(prefix => prefix + (quasi.value.cooked ?? quasi.value.raw));
          const part = expression.expressions[index];
          if (part) {
            values = combine(
              values,
              interpolation(part, expression.quasis[index + 1]?.value.raw ?? '', seen)
            );
          }
        }
        return values;
      }
      const returns = getFunctionReturns(expression);
      if (returns) {
        return returns.flatMap(resolve);
      }
      if (
        expression.type === 'TaggedTemplateExpression' ||
        expression.type === 'CallExpression'
      ) {
        const info = getStyledCallInfo(expression, imports);
        if (info) {
          return [info.kind === 'css' ? '' : 'sentry-interpolation'];
        }
        if (expression.type === 'CallExpression') {
          const fn = binding(expression.callee);
          if (fn) {
            return resolve(fn);
          }
          return suffix.trim() ? [''] : ['sentry-interpolation'];
        }
      }
      if (
        expression.type === 'ObjectExpression' ||
        expression.type === 'ArrayExpression' ||
        (expression.type === 'Literal' &&
          (typeof expression.value === 'boolean' || expression.value === null))
      ) {
        return [''];
      }
      if (expression.type !== 'Identifier') {
        return ['sentry-interpolation'];
      }
      const {name} = expression;
      const imported = imports.resolve(expression)?.imported;
      if (
        (imported && /^[A-Z]/.test(imported) && !CONSTANT_CASE.test(imported)) ||
        (imported === 'default' && /^[A-Z]/.test(name))
      ) {
        return ['sentry-interpolation'];
      }
      // Imported selector constants cannot be evaluated across module boundaries.
      if (CONSTANT_CASE.test(name)) {
        return ['.sentry-dynamic-selector'];
      }
      return /^[a-z]/.test(name) && /^\s*\n/.test(suffix)
        ? ['']
        : ['sentry-interpolation'];
    }

    function checkCss(node: ESTree.TemplateLiteral | ESTree.StringLiteral) {
      const template = node.type === 'TemplateLiteral' ? node : null;
      const selectors: ParsedCssSelector[] = [];
      const source =
        node.type === 'TemplateLiteral'
          ? context.sourceCode.getText(node)
          : '`' +
            node.value
              .replace(/\\/g, '\\\\')
              .replace(/`/g, '\\`')
              .replace(/\$\{/g, '\\${') +
            '`';
      parseCssTemplate(template, source, {selectors});
      for (const selector of selectors) {
        let values = [''];
        let cursor = 0;
        for (const {expression, range} of selector.interpolations) {
          const staticText = cookCssTemplateText(selector.value.slice(cursor, range[0]));
          values = combine(
            values.map(value => value + staticText),
            interpolation(expression, selector.value.slice(range[1]))
          );
          cursor = range[1];
        }
        const last = cookCssTemplateText(selector.value.slice(cursor));
        if (
          values.some(value => hasDomCoupling(value + last)) &&
          !isDisabledByDirectives(selector, selector.sourceRange[0], context.id)
        ) {
          context.report({
            node,
            ...(template
              ? {
                  loc: {
                    start: context.sourceCode.getLocFromIndex(
                      template.range[0] + selector.sourceRange[0]
                    ),
                    end: context.sourceCode.getLocFromIndex(
                      template.range[0] + selector.sourceRange[1]
                    ),
                  },
                }
              : {}),
            messageId: 'forbidden',
          });
        }
      }
      for (const expression of template?.expressions ?? []) {
        styles(expression);
      }
    }

    function isNestedStyle(node: ESTree.Node, seen = new Set<ESTree.Node>()): boolean {
      node = unwrapTypeWrappers(node);
      if (seen.has(node)) {
        return false;
      }
      seen.add(node);
      if (node.type === 'Identifier' || node.type === 'MemberExpression') {
        const value = binding(node);
        return value ? isNestedStyle(value, seen) : false;
      }
      if (node.type === 'ConditionalExpression') {
        return (
          isNestedStyle(node.consequent, new Set(seen)) ||
          isNestedStyle(node.alternate, new Set(seen))
        );
      }
      if (node.type === 'LogicalExpression') {
        return (
          isNestedStyle(node.left, new Set(seen)) ||
          isNestedStyle(node.right, new Set(seen))
        );
      }
      if (node.type === 'CallExpression' || node.type === 'TaggedTemplateExpression') {
        if (getStyledCallInfo(node, imports)?.kind === 'css') {
          return true;
        }
        if (node.type === 'CallExpression') {
          const fn = binding(node.callee);
          return fn ? isNestedStyle(fn, seen) : false;
        }
      }
      const returns = getFunctionReturns(node);
      if (returns) {
        return returns.some(value => isNestedStyle(value, new Set(seen)));
      }
      return (
        node.type === 'ObjectExpression' ||
        (node.type === 'ArrayExpression' &&
          node.elements.some(
            element =>
              element &&
              isNestedStyle(
                element.type === 'SpreadElement' ? element.argument : element,
                seen
              )
          ))
      );
    }

    function getKeySelectors(property: ESTree.ObjectProperty) {
      const name = getPropertyName(property);
      if (name !== null) {
        return [name];
      }
      const {computed, key} = property;
      if (!computed) {
        return null;
      }
      if (
        key.type === 'CallExpression' &&
        key.callee.type === 'Identifier' &&
        key.callee.name === 'String' &&
        !imports.resolveVariable(key.callee)
      ) {
        const [argument] = key.arguments;
        if (argument && argument.type !== 'SpreadElement') {
          return interpolation(argument, '');
        }
      }
      return interpolation(key, '');
    }

    function checkObject(node: ESTree.ObjectExpression) {
      for (const property of node.properties) {
        if (property.type === 'SpreadElement') {
          styles(property.argument);
          continue;
        }
        let coupled = false;
        let nested = false;
        for (const selector of getKeySelectors(property) ?? []) {
          if (/^@(?:-\w+-)?keyframes\b/i.test(selector)) {
            continue;
          }
          if (selector.startsWith('@')) {
            nested = true;
          } else if (!/^[\w-]+$/.test(selector) || isNestedStyle(property.value)) {
            nested = true;
            coupled ||= hasDomCoupling(selector);
          }
        }
        if (coupled) {
          context.report({node: property.key, messageId: 'forbidden'});
        }
        if (nested) {
          styles(property.value);
        }
      }
    }

    function styles(node: ESTree.Node, config = false) {
      node = unwrapTypeWrappers(node);
      if (visited.has(node)) {
        return;
      }
      visited.add(node);
      const returns = getFunctionReturns(node);
      if (returns) {
        for (const value of returns) {
          styles(value, config);
        }
      } else if (
        (node.type === 'Literal' && typeof node.value === 'string') ||
        node.type === 'TemplateLiteral'
      ) {
        checkCss(node);
      } else if (node.type === 'Identifier' || node.type === 'MemberExpression') {
        const value = binding(node);
        if (value) {
          styles(value, config);
        }
      } else if (node.type === 'ObjectExpression') {
        if (config) {
          for (const property of node.properties) {
            if (property.type === 'Property') {
              styles(property.value);
            } else {
              styles(property.argument, true);
            }
          }
        } else {
          checkObject(node);
        }
      } else if (node.type === 'ArrayExpression') {
        for (const element of node.elements) {
          if (element) {
            styles(element.type === 'SpreadElement' ? element.argument : element, config);
          }
        }
      } else if (node.type === 'ConditionalExpression') {
        styles(node.consequent, config);
        styles(node.alternate, config);
      } else if (node.type === 'LogicalExpression') {
        styles(node.left, config);
        styles(node.right, config);
      } else if (node.type === 'CallExpression') {
        const memo =
          imports.is(node.callee, 'react', 'useMemo') ||
          imports.is(node.callee, 'react', 'useCallback');
        if (getStyledCallInfo(node, imports) || memo) {
          // Memo dependencies are data, not styles passed to Emotion.
          for (const argument of memo ? node.arguments.slice(0, 1) : node.arguments) {
            if (argument.type !== 'SpreadElement') {
              styles(argument, config);
            }
          }
        } else {
          const fn = binding(node.callee);
          if (fn) {
            styles(fn, config);
          }
        }
      }
    }

    function getStyleType(type: ESTree.TSType) {
      if (type.type !== 'TSTypeReference') {
        return;
      }
      const definition = imports.resolveVariable(type.typeName)?.defs[0];
      if (
        definition?.type !== 'ImportBinding' ||
        definition.parent?.type !== 'ImportDeclaration' ||
        !STYLE_TYPE_SOURCES.has(definition.parent.source.value) ||
        definition.node.type !== 'ImportSpecifier' ||
        definition.node.imported.type !== 'Identifier'
      ) {
        return;
      }
      return STYLE_TYPES.get(definition.node.imported.name);
    }

    return {
      TaggedTemplateExpression(node) {
        if (getStyledCallInfo(node, imports)) {
          checkCss(node.quasi);
        }
      },
      CallExpression(node) {
        if (getStyledCallInfo(node, imports)) {
          styles(node);
        }
      },
      JSXAttribute(node) {
        if (node.value?.type !== 'JSXExpressionContainer') {
          return;
        }
        const element = node.parent;
        const config =
          node.name.name === 'styles' &&
          element.type === 'JSXOpeningElement' &&
          imports.is(element.name, '@sentry/scraps/select', 'Select');
        if (node.name.name === 'css' || config) {
          styles(node.value.expression, config);
        }
      },
      TSTypeAnnotation(node) {
        const styleType = getStyleType(node.typeAnnotation);
        if (!styleType) {
          return;
        }
        const config = styleType === 'config';
        const parent = node.parent;
        if (
          parent.type === 'Identifier' &&
          parent.parent.type === 'VariableDeclarator' &&
          parent.parent.init
        ) {
          styles(parent.parent.init, config);
        } else if (
          parent.type === 'FunctionDeclaration' ||
          parent.type === 'ArrowFunctionExpression' ||
          parent.type === 'FunctionExpression'
        ) {
          styles(parent, config);
        }
      },
      TSSatisfiesExpression(node) {
        const styleType = getStyleType(node.typeAnnotation);
        if (styleType) {
          styles(node.expression, styleType === 'config');
        }
      },
    };
  },
});
