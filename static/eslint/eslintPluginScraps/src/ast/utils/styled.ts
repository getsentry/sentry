/**
 * @file Shared utility for classifying styled/css tagged template and call expressions.
 *
 * Replaces ad-hoc tag detection duplicated across rules with a single function
 * that returns a discriminated union describing what the node represents.
 */

import type {TSESTree} from '@typescript-eslint/utils';

/**
 * Discriminated union describing a styled/css call site.
 *
 * - `element`: `styled.div`, `styled('div')` — styles an HTML element
 * - `component`: `styled(Button)`, `styled(Mod.Button)` — wraps a component
 * - `css`: bare `css` tagged template
 */
export type StyledCallInfo =
  | {kind: 'element'; name: string; tag: TSESTree.Node}
  | {kind: 'component'; name: string; tag: TSESTree.Node}
  | {kind: 'css'; tag: TSESTree.Node}
  | null;

/**
 * Get the name string from a member expression chain (e.g. `Mod.Button` → "Mod.Button").
 */
function getMemberName(node: TSESTree.Node): string | null {
  if (node.type === 'Identifier') {
    return node.name;
  }
  if (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier'
  ) {
    const objectName = getMemberName(node.object);
    if (objectName) {
      return `${objectName}.${node.property.name}`;
    }
  }
  return null;
}

/**
 * Classify a name as element or component using React's capitalization convention.
 */
function classifyName(name: string, tag: TSESTree.Node): NonNullable<StyledCallInfo> {
  // Dot-notation names (Mod.Button) are always components
  if (name.includes('.')) {
    return {kind: 'component', name, tag};
  }
  // Uppercase first letter = component, lowercase = HTML element
  if (/^[a-z]/.test(name)) {
    return {kind: 'element', name, tag};
  }
  return {kind: 'component', name, tag};
}

/**
 * Classify a styled/css call from its tag or callee expression, without
 * needing a reference to the parent node.
 *
 * This is the core classification logic — `getStyledCallInfo` is a thin
 * wrapper that extracts the tag/callee and delegates here.
 */
function classifyTag(tag: TSESTree.Node): StyledCallInfo {
  // css`...` — bare identifier
  if (tag.type === 'Identifier' && tag.name === 'css') {
    return {kind: 'css', tag};
  }

  // MemberExpression patterns
  if (tag.type === 'MemberExpression') {
    // X.css`...`
    if (tag.property.type === 'Identifier' && tag.property.name === 'css') {
      return {kind: 'css', tag};
    }

    // styled.div`...` or styled.div({...})
    if (
      tag.object.type === 'Identifier' &&
      tag.object.name === 'styled' &&
      tag.property.type === 'Identifier'
    ) {
      return classifyName(tag.property.name, tag);
    }

    // styled(Component).attrs({})`...` — unwrap .attrs and recurse on inner call
    if (
      tag.property.type === 'Identifier' &&
      tag.property.name === 'attrs' &&
      tag.object.type === 'CallExpression'
    ) {
      return classifyTag(tag.object);
    }
  }

  // CallExpression patterns: styled('div') or styled(Component)
  if (tag.type === 'CallExpression') {
    const innerCallee = tag.callee;

    // styled(X)
    if (innerCallee.type === 'Identifier' && innerCallee.name === 'styled') {
      return classifyStyledArgs(tag.arguments, tag);
    }

    // styled(X).attrs({})(...) — unwrap .attrs and recurse on inner call
    if (
      innerCallee.type === 'MemberExpression' &&
      innerCallee.property.type === 'Identifier' &&
      innerCallee.property.name === 'attrs' &&
      innerCallee.object.type === 'CallExpression'
    ) {
      return classifyTag(innerCallee.object);
    }
  }

  return null;
}

/**
 * Classify a `styled(...)` call from its arguments.
 */
function classifyStyledArgs(
  args: TSESTree.CallExpressionArgument[],
  tag: TSESTree.Node
): StyledCallInfo {
  const arg = args[0];
  if (!arg) {
    return null;
  }
  if (arg.type === 'Literal' && typeof arg.value === 'string') {
    return classifyName(arg.value, tag);
  }
  const name = getMemberName(arg);
  if (name) {
    return classifyName(name, tag);
  }
  return null;
}

/**
 * Classify a TaggedTemplateExpression or CallExpression as a styled/css pattern.
 *
 * Handles:
 * - `styled.div\`...\`` and `styled.div({...})`
 * - `styled('div')\`...\`` and `styled('div')({...})`
 * - `styled(Component)\`...\`` and `styled(Component)({...})`
 * - `styled(Mod.Component)\`...\``
 * - `styled(Component).attrs({...})\`...\``
 * - `css\`...\``
 * - `X.css\`...\`` (member expression ending in css)
 */
export function getStyledCallInfo(
  node: TSESTree.TaggedTemplateExpression | TSESTree.CallExpression
): StyledCallInfo {
  const tag = node.type === 'TaggedTemplateExpression' ? node.tag : node.callee;

  // Try classifying from the tag/callee expression
  const result = classifyTag(tag);
  if (result) {
    return result;
  }

  // Direct styled(X) as a CallExpression node (not as tag of template)
  if (
    node.type === 'CallExpression' &&
    tag.type === 'Identifier' &&
    tag.name === 'styled'
  ) {
    return classifyStyledArgs(node.arguments, node);
  }

  return null;
}
