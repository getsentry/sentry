import {AST_NODE_TYPES, type TSESTree} from '@typescript-eslint/utils';
import type {SourceCode} from '@typescript-eslint/utils/ts-eslint';

function containsJsx(node: TSESTree.Node, sourceCode: SourceCode): boolean {
  const stack = [node];

  while (stack.length) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    if (
      current.type === AST_NODE_TYPES.JSXElement ||
      current.type === AST_NODE_TYPES.JSXFragment
    ) {
      return true;
    }

    const keys = sourceCode.visitorKeys[current.type] ?? [];

    for (const key of keys) {
      const child = (current as any)[key];

      if (Array.isArray(child)) {
        stack.push(...child);
      } else if (child) {
        stack.push(child);
      }
    }
  }

  return false;
}

function getFunctionName(
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression
) {
  return (
    (node.type === AST_NODE_TYPES.FunctionDeclaration ||
      node.type === AST_NODE_TYPES.FunctionExpression) &&
    node.id?.name
  );
}

const PASCAL_CASE_RE = /^[A-Z][A-Za-z0-9]*$/u;

function isPascalCase(name: string) {
  return PASCAL_CASE_RE.test(name);
}

function isStyledCallExpression(node: TSESTree.Node) {
  if (node.type !== AST_NODE_TYPES.CallExpression) {
    return false;
  }
  const callee = node.callee;
  return (
    (callee.type === AST_NODE_TYPES.Identifier && callee.name === 'styled') ||
    (callee.type === AST_NODE_TYPES.MemberExpression &&
      callee.property.type === AST_NODE_TYPES.Identifier &&
      callee.property.name === 'styled')
  );
}

function isStyledComponentInit(node: TSESTree.Node) {
  if (isStyledCallExpression(node)) {
    return true;
  }
  if (node.type === AST_NODE_TYPES.TaggedTemplateExpression) {
    return isStyledCallExpression(node.tag);
  }
  return false;
}

export function isReactComponentLike(node: TSESTree.Node, sourceCode: SourceCode) {
  switch (node.type) {
    case AST_NODE_TYPES.ClassDeclaration:
      return (
        node.superClass !== null &&
        node.superClass.type === AST_NODE_TYPES.Identifier &&
        node.superClass.name.includes('Component')
      );

    case AST_NODE_TYPES.FunctionDeclaration:
    case AST_NODE_TYPES.FunctionExpression:
    case AST_NODE_TYPES.ArrowFunctionExpression: {
      const name = getFunctionName(node);
      if (name && isPascalCase(name)) {
        return true;
      }

      return containsJsx(node.body, sourceCode);
    }

    case AST_NODE_TYPES.Identifier:
      return isPascalCase(node.name);

    case AST_NODE_TYPES.VariableDeclarator: {
      if (
        node.id.type !== AST_NODE_TYPES.Identifier ||
        !node.init ||
        !isPascalCase(node.id.name)
      ) {
        return false;
      }

      if (
        node.init.type === AST_NODE_TYPES.ArrowFunctionExpression ||
        node.init.type === AST_NODE_TYPES.FunctionExpression
      ) {
        return containsJsx(node.init, sourceCode);
      }

      if (isStyledComponentInit(node.init)) {
        return true;
      }

      return false;
    }

    default:
      return false;
  }
}
