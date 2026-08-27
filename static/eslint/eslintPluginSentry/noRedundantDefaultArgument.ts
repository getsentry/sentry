import {AST_NODE_TYPES, ESLintUtils, type TSESTree} from '@typescript-eslint/utils';
import type {Scope} from '@typescript-eslint/utils/ts-eslint';

const NOT_HARDCODED = Symbol('not hardcoded');

type HardcodedValue = string | number | boolean | bigint | null;

interface DefaultValue {
  name: string;
  value: HardcodedValue;
}

interface FunctionDefaults {
  objectProperties: Map<number, Map<string, DefaultValue>>;
  positional: Map<number, DefaultValue>;
}

function getHardcodedValue(node: TSESTree.Node): HardcodedValue | typeof NOT_HARDCODED {
  if (
    node.type === AST_NODE_TYPES.TSAsExpression ||
    node.type === AST_NODE_TYPES.TSTypeAssertion ||
    node.type === AST_NODE_TYPES.TSNonNullExpression
  ) {
    return getHardcodedValue(node.expression);
  }

  if (node.type === AST_NODE_TYPES.Literal) {
    if (
      node.value === null ||
      typeof node.value === 'string' ||
      typeof node.value === 'number' ||
      typeof node.value === 'boolean' ||
      typeof node.value === 'bigint'
    ) {
      return node.value;
    }
    return NOT_HARDCODED;
  }

  if (
    node.type === AST_NODE_TYPES.TemplateLiteral &&
    node.expressions.length === 0 &&
    node.quasis[0]?.value.cooked !== null &&
    node.quasis[0]?.value.cooked !== undefined
  ) {
    return node.quasis[0].value.cooked;
  }

  if (
    node.type === AST_NODE_TYPES.UnaryExpression &&
    (node.operator === '-' || node.operator === '+') &&
    node.argument.type === AST_NODE_TYPES.Literal &&
    typeof node.argument.value === 'number'
  ) {
    return node.operator === '-' ? -node.argument.value : node.argument.value;
  }

  return NOT_HARDCODED;
}

function getPropertyName(
  key: TSESTree.PropertyName,
  computed: boolean
): string | undefined {
  if (computed) {
    return undefined;
  }
  if (key.type === AST_NODE_TYPES.Identifier) {
    return key.name;
  }
  if (
    key.type === AST_NODE_TYPES.Literal &&
    (typeof key.value === 'string' || typeof key.value === 'number')
  ) {
    return String(key.value);
  }
  return undefined;
}

function getObjectDefaults(pattern: TSESTree.ObjectPattern) {
  const defaults = new Map<string, DefaultValue>();

  for (const property of pattern.properties) {
    if (
      property.type !== AST_NODE_TYPES.Property ||
      property.value.type !== AST_NODE_TYPES.AssignmentPattern
    ) {
      continue;
    }

    const name = getPropertyName(property.key, property.computed);
    const value = getHardcodedValue(property.value.right);
    if (name !== undefined && value !== NOT_HARDCODED) {
      defaults.set(name, {name, value});
    }
  }

  return defaults;
}

function getFunctionDefaults(
  node:
    | TSESTree.ArrowFunctionExpression
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
): FunctionDefaults {
  const defaults: FunctionDefaults = {
    objectProperties: new Map(),
    positional: new Map(),
  };

  node.params.forEach((parameter, index) => {
    if (parameter.type === AST_NODE_TYPES.AssignmentPattern) {
      if (parameter.left.type === AST_NODE_TYPES.Identifier) {
        const value = getHardcodedValue(parameter.right);
        if (value !== NOT_HARDCODED) {
          defaults.positional.set(index, {name: parameter.left.name, value});
        }
      } else if (parameter.left.type === AST_NODE_TYPES.ObjectPattern) {
        const properties = getObjectDefaults(parameter.left);
        if (properties.size > 0) {
          defaults.objectProperties.set(index, properties);
        }
      }
      return;
    }

    if (parameter.type === AST_NODE_TYPES.ObjectPattern) {
      const properties = getObjectDefaults(parameter);
      if (properties.size > 0) {
        defaults.objectProperties.set(index, properties);
      }
    }
  });

  return defaults;
}

function hasDefaults(defaults: FunctionDefaults): boolean {
  return defaults.positional.size > 0 || defaults.objectProperties.size > 0;
}

export const noRedundantDefaultArgument = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow hardcoded function arguments and JSX props that equal their local default value.',
    },
    schema: [],
    messages: {
      redundantDefaultValue:
        'Do not pass the default value for "{{name}}". Omit this {{kind}}.',
    },
  },
  create(context) {
    const defaultsByVariable = new Map<Scope.Variable, FunctionDefaults>();
    const calls: Array<{node: TSESTree.CallExpression; variable: Scope.Variable}> = [];
    const elements: Array<{
      node: TSESTree.JSXOpeningElement;
      variable: Scope.Variable;
    }> = [];

    function resolveVariable(node: TSESTree.Identifier | TSESTree.JSXIdentifier) {
      let scope: Scope.Scope | null = context.sourceCode.getScope(node);
      while (scope) {
        const variable = scope.variables.find(candidate => candidate.name === node.name);
        if (variable) {
          return variable;
        }
        scope = scope.upper;
      }
      return;
    }

    function registerFunction(
      identifier: TSESTree.Identifier,
      node:
        | TSESTree.ArrowFunctionExpression
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
    ) {
      const variable = resolveVariable(identifier);
      const defaults = getFunctionDefaults(node);
      if (variable && hasDefaults(defaults)) {
        defaultsByVariable.set(variable, defaults);
      }
    }

    function report(node: TSESTree.Node, defaultValue: DefaultValue, kind: string) {
      context.report({
        node,
        messageId: 'redundantDefaultValue',
        data: {kind, name: defaultValue.name},
      });
    }

    function isStable(variable: Scope.Variable) {
      return !variable.references.some(
        reference => reference.isWrite() && !reference.init
      );
    }

    function checkObjectExpression(
      node: TSESTree.ObjectExpression,
      defaults: Map<string, DefaultValue>
    ) {
      const seen = new Set<string>();

      for (let index = node.properties.length - 1; index >= 0; index--) {
        const property = node.properties[index]!;
        if (property.type === AST_NODE_TYPES.SpreadElement) {
          break;
        }
        if (property.type !== AST_NODE_TYPES.Property) {
          continue;
        }

        const name = getPropertyName(property.key, property.computed);
        if (name === undefined || seen.has(name)) {
          continue;
        }
        seen.add(name);

        const defaultValue = defaults.get(name);
        const value = getHardcodedValue(property.value);
        if (
          defaultValue &&
          value !== NOT_HARDCODED &&
          Object.is(value, defaultValue.value)
        ) {
          report(property, defaultValue, 'property');
        }
      }
    }

    function checkCall(node: TSESTree.CallExpression, defaults: FunctionDefaults) {
      let firstRedundantPosition = node.arguments.length;

      for (let index = node.arguments.length - 1; index >= 0; index--) {
        const argument = node.arguments[index]!;
        const defaultValue = defaults.positional.get(index);
        const value = getHardcodedValue(argument);
        if (
          !defaultValue ||
          value === NOT_HARDCODED ||
          !Object.is(value, defaultValue.value)
        ) {
          break;
        }
        firstRedundantPosition = index;
      }

      for (let index = firstRedundantPosition; index < node.arguments.length; index++) {
        report(node.arguments[index]!, defaults.positional.get(index)!, 'argument');
      }

      node.arguments.forEach((argument, index) => {
        const objectDefaults = defaults.objectProperties.get(index);
        if (argument.type === AST_NODE_TYPES.ObjectExpression && objectDefaults) {
          checkObjectExpression(argument, objectDefaults);
        }
      });
    }

    function checkElement(node: TSESTree.JSXOpeningElement, defaults: FunctionDefaults) {
      const propDefaults = defaults.objectProperties.get(0);
      if (!propDefaults) {
        return;
      }

      const seen = new Set<string>();
      for (let index = node.attributes.length - 1; index >= 0; index--) {
        const attribute = node.attributes[index]!;
        if (attribute.type === AST_NODE_TYPES.JSXSpreadAttribute) {
          break;
        }
        if (attribute.name.type !== AST_NODE_TYPES.JSXIdentifier) {
          continue;
        }

        const name = attribute.name.name;
        if (seen.has(name)) {
          continue;
        }
        seen.add(name);

        const defaultValue = propDefaults.get(name);
        if (!defaultValue) {
          continue;
        }

        let value: HardcodedValue | typeof NOT_HARDCODED = true;
        if (attribute.value?.type === AST_NODE_TYPES.JSXExpressionContainer) {
          value = getHardcodedValue(attribute.value.expression);
        } else if (attribute.value) {
          value = getHardcodedValue(attribute.value);
        }

        if (value !== NOT_HARDCODED && Object.is(value, defaultValue.value)) {
          report(attribute, defaultValue, 'prop');
        }
      }
    }

    return {
      FunctionDeclaration(node) {
        if (node.id) {
          registerFunction(node.id, node);
        }
      },

      VariableDeclarator(node) {
        if (
          node.parent.kind === 'const' &&
          node.id.type === AST_NODE_TYPES.Identifier &&
          (node.init?.type === AST_NODE_TYPES.ArrowFunctionExpression ||
            node.init?.type === AST_NODE_TYPES.FunctionExpression)
        ) {
          registerFunction(node.id, node.init);
        }
      },

      CallExpression(node) {
        if (node.callee.type !== AST_NODE_TYPES.Identifier) {
          return;
        }
        const variable = resolveVariable(node.callee);
        if (variable) {
          calls.push({node, variable});
        }
      },

      JSXOpeningElement(node) {
        if (
          node.name.type !== AST_NODE_TYPES.JSXIdentifier ||
          node.name.name[0] !== node.name.name[0]?.toUpperCase()
        ) {
          return;
        }
        const variable = resolveVariable(node.name);
        if (variable) {
          elements.push({node, variable});
        }
      },

      'Program:exit'() {
        for (const {node, variable} of calls) {
          if (!isStable(variable)) {
            continue;
          }
          const defaults = defaultsByVariable.get(variable);
          if (defaults) {
            checkCall(node, defaults);
          }
        }
        for (const {node, variable} of elements) {
          if (!isStable(variable)) {
            continue;
          }
          const defaults = defaultsByVariable.get(variable);
          if (defaults) {
            checkElement(node, defaults);
          }
        }
      },
    };
  },
});
