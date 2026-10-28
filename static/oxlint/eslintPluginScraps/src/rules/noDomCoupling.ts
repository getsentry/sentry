import {defineRule, type ESTree} from '@oxlint/plugins';

import {
  cookCssTemplateText,
  parseCssTemplate,
  type ParsedCssSelector,
} from '../ast/extractor/css.ts';
import {createImportTracker} from '../ast/tracker/imports.ts';
import {COMPONENT_SELECTOR, getDomCouplingTarget} from '../ast/utils/selectors.ts';
import {getStyledCallInfo} from '../ast/utils/styled.ts';

const targets = {
  component: 'A component selector',
  element: 'A DOM element selector',
  universal: 'A universal selector',
  unscoped: 'An unscoped selector',
};

function unwrap(node: ESTree.Node): ESTree.Node {
  while (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSTypeAssertion'
  ) {
    node = node.expression;
  }
  return node;
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
        '{{target}} relies on component or DOM implementation details. Use an explicit class, ID, or attribute target instead.',
    },
  },
  create(context) {
    const imports = createImportTracker(context);
    const visited = new Set<ESTree.Node>();
    const reported = new Set<ESTree.Node>();
    const cssTypes = new Set<string>();
    const configTypes = new Set<string>();

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
            property =>
              property.type === 'Property' &&
              (property.key.type === 'Identifier' && !property.computed
                ? property.key.name
                : stringValue(property.key)) === name
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

    function stringValue(
      node: ESTree.Node,
      seen = new Set<ESTree.Node>()
    ): string | null {
      node = unwrap(node);
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

    function returnedValues(node: ESTree.Node): ESTree.Node[] {
      if (node.type === 'ReturnStatement') {
        return node.argument ? [node.argument] : [];
      }
      if (node.type === 'BlockStatement') {
        return node.body.flatMap(returnedValues);
      }
      if (node.type === 'SwitchStatement') {
        return node.cases.flatMap(switchCase =>
          switchCase.consequent.flatMap(returnedValues)
        );
      }
      if (node.type === 'IfStatement') {
        return [
          ...returnedValues(node.consequent),
          ...(node.alternate ? returnedValues(node.alternate) : []),
        ];
      }
      return [];
    }

    function combine(prefixes: string[], suffixes: string[]): string[] {
      return [
        ...new Set(prefixes.flatMap(prefix => suffixes.map(suffix => prefix + suffix))),
      ];
    }

    function interpolation(
      expression: ESTree.Node,
      suffix: string,
      seen = new Set<ESTree.Node>()
    ): string[] {
      expression = unwrap(expression);
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
      if (
        expression.type === 'ArrowFunctionExpression' ||
        expression.type === 'FunctionExpression' ||
        expression.type === 'FunctionDeclaration'
      ) {
        if (!expression.body) {
          return [''];
        }
        if (expression.body.type === 'BlockStatement') {
          const values = returnedValues(expression.body).flatMap(resolve);
          return values.length ? values : [''];
        }
        return resolve(expression.body);
      }
      if (
        expression.type === 'TaggedTemplateExpression' ||
        expression.type === 'CallExpression'
      ) {
        const info = getStyledCallInfo(expression, imports);
        if (info) {
          return [info.kind === 'css' ? '' : COMPONENT_SELECTOR];
        }
        if (expression.type === 'CallExpression') {
          const fn = binding(expression.callee);
          if (fn) {
            return resolve(fn);
          }
          return suffix.trim() ? [''] : [COMPONENT_SELECTOR];
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
      const name = context.sourceCode.getText(expression);
      const imported = imports.resolve(expression)?.imported;
      if (
        (imported && /^[A-Z]/.test(imported) && !/^[A-Z][A-Z\d_]+$/.test(imported)) ||
        (imported === 'default' && /^[A-Z]/.test(name))
      ) {
        return [COMPONENT_SELECTOR];
      }
      // Imported selector constants cannot be evaluated across module boundaries.
      if (/^[A-Z][A-Z\d_]+$/.test(name)) {
        return ['.sentry-dynamic-selector'];
      }
      if (
        expression.type === 'Identifier' &&
        /^[a-z]/.test(name) &&
        /^\s*\n/.test(suffix)
      ) {
        return [''];
      }
      return [COMPONENT_SELECTOR];
    }

    function checkTemplate(node: ESTree.TaggedTemplateExpression) {
      if (!getStyledCallInfo(node, imports)) {
        return;
      }
      checkCss(node.quasi, node);
    }

    function checkCss(
      template: ESTree.TemplateLiteral | null,
      node: ESTree.Node,
      text?: string
    ) {
      const selectors: ParsedCssSelector[] = [];
      const source = template
        ? context.sourceCode.getText(template)
        : '`' +
          (text ?? '')
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$\{/g, '\\${') +
          '`';
      parseCssTemplate(template, source, undefined, selectors);
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
        const target = values
          .map(value => getDomCouplingTarget(value + last))
          .find(value => value !== undefined);
        if (!target) {
          continue;
        }
        let disabled = false;
        let disabledLine = false;
        for (const directive of selector.directives) {
          if (directive.rules.length && !directive.rules.includes(context.id)) {
            continue;
          }
          if (directive.action === 'disable-next-line') {
            disabledLine ||= selector.line === (directive.endLine ?? -2) + 1;
          } else if (directive.action === 'disable-line') {
            disabledLine ||= selector.line === directive.line;
          } else if (directive.offset < selector.sourceRange[0]) {
            disabled = directive.action === 'disable';
          }
        }
        if (!disabled && !disabledLine) {
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
            data: {target: targets[target]},
          });
        }
      }
      for (const expression of template?.expressions ?? []) {
        styles(expression);
      }
    }

    function isNestedStyle(node: ESTree.Node, seen = new Set<ESTree.Node>()): boolean {
      node = unwrap(node);
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
      if (
        node.type === 'ArrowFunctionExpression' ||
        node.type === 'FunctionExpression' ||
        node.type === 'FunctionDeclaration'
      ) {
        if (!node.body) {
          return false;
        }
        return node.body.type === 'BlockStatement'
          ? returnedValues(node.body).some(value => isNestedStyle(value, new Set(seen)))
          : isNestedStyle(node.body, seen);
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

    function checkObject(node: ESTree.ObjectExpression) {
      for (const property of node.properties) {
        if (property.type === 'SpreadElement') {
          styles(property.argument);
          continue;
        }
        if (property.type !== 'Property') {
          continue;
        }
        const key = property.key;
        const value = stringValue(key);
        let selectors = value === null ? null : [value];
        if (property.computed && selectors === null) {
          if (
            key.type === 'CallExpression' &&
            key.callee.type === 'Identifier' &&
            key.callee.name === 'String' &&
            key.arguments[0] &&
            key.arguments[0].type !== 'SpreadElement'
          ) {
            selectors = interpolation(key.arguments[0], '');
          } else {
            selectors = interpolation(key, '');
          }
        } else if (!property.computed && key.type === 'Identifier') {
          selectors = [key.name];
        }
        if (selectors === null) {
          continue;
        }
        for (const selector of selectors) {
          if (/^@(?:-\w+-)?keyframes\b/i.test(selector)) {
            continue;
          }
          if (selector.startsWith('@')) {
            styles(property.value);
            continue;
          }
          if (!/^[\w-]+$/.test(selector) || isNestedStyle(property.value)) {
            const target = getDomCouplingTarget(selector);
            if (target && !reported.has(key)) {
              reported.add(key);
              context.report({
                node: key,
                messageId: 'forbidden',
                data: {target: targets[target]},
              });
            }
            styles(property.value);
          }
        }
      }
    }

    function styles(node: ESTree.Node, config = false) {
      node = unwrap(node);
      if (visited.has(node)) {
        return;
      }
      visited.add(node);
      if (node.type === 'Literal' && typeof node.value === 'string') {
        checkCss(null, node, node.value);
      } else if (node.type === 'TemplateLiteral') {
        checkCss(node, node);
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
      } else if (
        node.type === 'ArrowFunctionExpression' ||
        node.type === 'FunctionExpression' ||
        node.type === 'FunctionDeclaration'
      ) {
        if (!node.body) {
          return;
        }
        if (node.body.type === 'BlockStatement') {
          for (const value of returnedValues(node.body)) {
            styles(value, config);
          }
        } else {
          styles(node.body, config);
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

    return {
      ...imports.visitors,
      ImportDeclaration(node) {
        imports.visitors.ImportDeclaration?.(node);
        if (
          node.source.value !== '@emotion/react' &&
          node.source.value !== '@emotion/serialize' &&
          node.source.value !== '@sentry/scraps/theme' &&
          node.source.value !== '@sentry/scraps/select'
        ) {
          return;
        }
        for (const specifier of node.specifiers) {
          if (
            specifier.type !== 'ImportSpecifier' ||
            specifier.imported.type !== 'Identifier'
          ) {
            continue;
          }
          if (['CSSObject', 'StrictCSSObject'].includes(specifier.imported.name)) {
            cssTypes.add(specifier.local.name);
          } else if (specifier.imported.name === 'StylesConfig') {
            configTypes.add(specifier.local.name);
          }
        }
      },
      TaggedTemplateExpression: checkTemplate,
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
        const type = node.typeAnnotation;
        if (type.type !== 'TSTypeReference' || type.typeName.type !== 'Identifier') {
          return;
        }
        const config = configTypes.has(type.typeName.name);
        if (!config && !cssTypes.has(type.typeName.name)) {
          return;
        }
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
        const type = node.typeAnnotation;
        if (type.type === 'TSTypeReference' && type.typeName.type === 'Identifier') {
          if (cssTypes.has(type.typeName.name) || configTypes.has(type.typeName.name)) {
            styles(node.expression, configTypes.has(type.typeName.name));
          }
        }
      },
    };
  },
});
