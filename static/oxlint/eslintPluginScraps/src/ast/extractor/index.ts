import type {Context, ESTree, Visitor} from '@oxlint/plugins';

import {createImportTracker} from '../tracker/imports.ts';
import {normalizePropertyName} from '../utils/normalizePropertyName.ts';
import {getStyledCallInfo} from '../utils/styled.ts';

import {isDisabledByCssDirective, parseCssTemplate} from './css.ts';

export interface TokenReference {
  node: ESTree.MemberExpression;
  tokenPath: string;
}

const THEME_NAMES = new Set(['p', 't']);

export function shouldAnalyze(context: Readonly<Context>) {
  const text = context.sourceCode.getText();
  return (
    text.includes('@emotion/styled') ||
    text.includes('@emotion/react') ||
    /\b(?:css|style)\s*=/.test(text)
  );
}

export function createStyleVisitors(
  context: Context,
  check: (property: string, token: TokenReference) => void
): Visitor {
  const importTracker = createImportTracker(context);
  const themeCallbacks = new Set<ESTree.ArrowFunctionExpression>();

  function isThemeBinding(node: ESTree.Node): boolean {
    const definition = importTracker.resolveVariable(node)?.defs[0];
    const declaration = definition?.node;
    if (declaration?.type === 'ArrowFunctionExpression') {
      return (
        themeCallbacks.has(declaration) && declaration.params[0] === definition?.name
      );
    }
    return (
      declaration?.type === 'VariableDeclarator' &&
      declaration.init?.type === 'CallExpression' &&
      importTracker.is(declaration.init.callee, '@emotion/react', 'useTheme')
    );
  }

  function findTokenReference(node: ESTree.MemberExpression): TokenReference | null {
    const path: string[] = [];
    let current: ESTree.Node = node;
    while (
      current.type === 'MemberExpression' &&
      current.property.type === 'Identifier'
    ) {
      path.unshift(current.property.name);
      current = current.object;
    }
    if (current.type === 'Identifier') {
      path.unshift(current.name);
    }
    const tokensIndex = path.indexOf('tokens');
    if (
      tokensIndex === -1 ||
      tokensIndex === path.length - 1 ||
      !(
        THEME_NAMES.has(path[0] ?? '') ||
        path.includes('theme') ||
        (current.type === 'Identifier' && isThemeBinding(current))
      )
    ) {
      return null;
    }
    return {node, tokenPath: path.slice(tokensIndex + 1).join('.')};
  }

  function checkValue(property: string, node: ESTree.Node): void {
    switch (node.type) {
      case 'ConditionalExpression':
        checkValue(property, node.consequent);
        checkValue(property, node.alternate);
        break;
      case 'LogicalExpression':
        checkValue(property, node.left);
        checkValue(property, node.right);
        break;
      case 'TemplateLiteral':
        for (const expression of node.expressions) {
          checkValue(property, expression);
        }
        break;
      case 'ArrowFunctionExpression':
        if (node.expression) {
          themeCallbacks.add(node);
          checkValue(property, node.body);
        }
        break;
      case 'MemberExpression': {
        const token = findTokenReference(node);
        if (token) {
          check(property, token);
        }
        break;
      }
      default:
        break;
    }
  }

  function checkObject(node: ESTree.ObjectExpression) {
    for (const property of node.properties) {
      if (
        property.type !== 'Property' ||
        (property.computed && property.key.type !== 'Literal')
      ) {
        continue;
      }
      const name =
        property.key.type === 'Identifier'
          ? property.key.name
          : property.key.type === 'Literal'
            ? String(property.key.value)
            : '';
      if (name) {
        checkValue(normalizePropertyName(name), property.value);
      }
    }
  }

  return {
    TaggedTemplateExpression(node) {
      if (!getStyledCallInfo(node, importTracker)) {
        return;
      }
      const declarations =
        parseCssTemplate(node.quasi, context.sourceCode.getText(node.quasi)) ?? [];
      for (const declaration of declarations) {
        if (isDisabledByCssDirective(declaration, context.id)) {
          continue;
        }
        for (const {expression} of declaration.interpolations) {
          checkValue(declaration.name, expression);
        }
      }
    },

    CallExpression(node) {
      const [argument] = node.arguments;
      if (
        argument?.type === 'ObjectExpression' &&
        getStyledCallInfo(node, importTracker)
      ) {
        checkObject(argument);
      }
    },

    JSXAttribute(node) {
      if (node.value?.type !== 'JSXExpressionContainer') {
        return;
      }
      const {expression} = node.value;
      if (node.name.name === 'style') {
        if (expression.type === 'ObjectExpression') {
          checkObject(expression);
        }
        return;
      }
      if (node.name.name !== 'css') {
        return;
      }
      if (expression.type === 'ObjectExpression') {
        checkObject(expression);
      } else if (expression.type === 'ArrayExpression') {
        for (const element of expression.elements) {
          if (element?.type === 'ObjectExpression') {
            checkObject(element);
          }
        }
      } else if (expression.type === 'ArrowFunctionExpression') {
        themeCallbacks.add(expression);
        if (expression.body.type === 'ObjectExpression') {
          checkObject(expression.body);
        }
      }
    },
  };
}
