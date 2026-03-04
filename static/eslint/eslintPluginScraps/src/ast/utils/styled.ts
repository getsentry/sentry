/**
 * @file Utilities for classifying styled-components/emotion tag expressions.
 *
 * Given the `tag` of a TaggedTemplateExpression (or callee of a CallExpression),
 * determines whether it's a styled/css pattern and what kind.
 */
import {AST_NODE_TYPES} from '@typescript-eslint/utils';
import type {TSESTree} from '@typescript-eslint/utils';

/**
 * Classification of a styled/css tag expression.
 */
type StyledTagInfo =
  | {kind: 'component'; name: string} // styled(Button), styled(Mod.Sub).attrs(...)
  | {kind: 'element'; name: string} // styled.div, styled('div')
  | {kind: 'css'} // css`...`
  | null; // not a styled/css tag

/**
 * Recursively builds a dotted name from a MemberExpression chain.
 * e.g. `SimpleTable.Header` → "SimpleTable.Header"
 */
function getMemberExpressionName(node: TSESTree.MemberExpression): string | null {
  const prop =
    node.property.type === AST_NODE_TYPES.Identifier ? node.property.name : null;
  if (!prop) {
    return null;
  }

  if (node.object.type === AST_NODE_TYPES.Identifier) {
    return `${node.object.name}.${prop}`;
  }
  if (node.object.type === AST_NODE_TYPES.MemberExpression) {
    const objName = getMemberExpressionName(node.object);
    return objName ? `${objName}.${prop}` : null;
  }
  return null;
}

/**
 * Classify the first argument of a `styled(...)` call.
 */
function classifyStyledCallArg(
  arg: TSESTree.CallExpressionArgument | undefined
): StyledTagInfo {
  if (!arg) {
    return null;
  }

  // styled('div') → element
  if (arg.type === AST_NODE_TYPES.Literal && typeof arg.value === 'string') {
    return {kind: 'element', name: arg.value};
  }

  // styled(Component) or styled(lowercaseVar)
  if (arg.type === AST_NODE_TYPES.Identifier) {
    return /^[A-Z]/.test(arg.name)
      ? {kind: 'component', name: arg.name}
      : {kind: 'element', name: arg.name};
  }

  // styled(Mod.Component)
  if (arg.type === AST_NODE_TYPES.MemberExpression) {
    const name = getMemberExpressionName(arg);
    if (name) {
      return /^[A-Z]/.test(name) ? {kind: 'component', name} : {kind: 'element', name};
    }
  }

  return null;
}

/**
 * Given the `tag` node of a TaggedTemplateExpression (or callee of a
 * styled object-syntax CallExpression), classify what kind of styled/css
 * pattern it represents.
 *
 * Handles:
 * - styled(Component)`...`              → {kind:'component', name:'Component'}
 * - styled(Mod.Component)`...`          → {kind:'component', name:'Mod.Component'}
 * - styled(Component).attrs(...)`...`   → {kind:'component', name:'Component'}
 * - styled.div`...`                     → {kind:'element', name:'div'}
 * - styled('div')`...`                  → {kind:'element', name:'div'}
 * - css`...`                            → {kind:'css'}
 * - Not a styled/css tag               → null
 */
export function getStyledInfo(tag: TSESTree.Expression): StyledTagInfo {
  // css`...`
  if (tag.type === AST_NODE_TYPES.Identifier && tag.name === 'css') {
    return {kind: 'css'};
  }

  // styled.div`...` or X.css`...`
  if (tag.type === AST_NODE_TYPES.MemberExpression) {
    const prop =
      tag.property.type === AST_NODE_TYPES.Identifier ? tag.property.name : null;
    if (!prop) {
      return null;
    }

    if (tag.object.type === AST_NODE_TYPES.Identifier && tag.object.name === 'styled') {
      return {kind: 'element', name: prop};
    }
    if (prop === 'css') {
      return {kind: 'css'};
    }
    return null;
  }

  // styled(Component)`...` or styled('div')`...`
  if (
    tag.type === AST_NODE_TYPES.CallExpression &&
    tag.callee.type === AST_NODE_TYPES.Identifier &&
    tag.callee.name === 'styled'
  ) {
    return classifyStyledCallArg(tag.arguments[0]);
  }

  // styled(Component).attrs(...)`...`
  if (
    tag.type === AST_NODE_TYPES.CallExpression &&
    tag.callee.type === AST_NODE_TYPES.MemberExpression
  ) {
    const obj = tag.callee.object;
    if (
      obj.type === AST_NODE_TYPES.CallExpression &&
      obj.callee.type === AST_NODE_TYPES.Identifier &&
      obj.callee.name === 'styled'
    ) {
      return classifyStyledCallArg(obj.arguments[0]);
    }
  }

  return null;
}
