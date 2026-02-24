/**
 * ESLint rule: restrict-jsx-slot-children
 *
 * Generic rule that restricts the JSX trees passed to specific props ("slots")
 * to a configurable set of allowed elements.
 *
 * Slots are identified by prop name.  Each allowed element comes from a known
 * import source and carries a role:
 *
 *   "leaf"    — allowed element, recursion stops here (the component's own
 *               internal JSX is not the slot's concern).
 *   "wrapper" — allowed element used to compose multiple children; the rule
 *               recurses into its direct JSX children and checks each one.
 *
 * Two element kinds are supported:
 *
 *   "member"  — any JSXMemberExpression whose object is a named export
 *               (e.g. <MenuComponents.HeaderButton>).
 *   "named"   — a specific set of JSX identifiers that are named exports
 *               (e.g. <Flex>, <Stack>).
 *
 * The rule handles direct JSX, arrow-function expression bodies, top-level
 * ternary / logical expressions, and JSXExpressionContainers inside wrapper
 * children.
 *
 * Known limitations:
 *   - Block-body callbacks (`() => { return <Elem>; }`) are not checked.
 *   - Variable references (`slotProp={someVar}`) are not checked.
 *
 * Example configuration (in eslint.config.mjs):
 *
 *   '@sentry/scraps/restrict-jsx-slot-children': [
 *     'warn',
 *     {
 *       propNames: ['menuHeaderTrailingItems', 'menuFooter'],
 *       allowed: [
 *         {
 *           type: 'member',
 *           source: '@sentry/scraps/compactSelect',
 *           objectName: 'MenuComponents',
 *           role: 'leaf',
 *         },
 *         {
 *           type: 'named',
 *           source: '@sentry/scraps/layout',
 *           names: ['Flex', 'Stack', 'Grid', 'Container'],
 *           role: 'wrapper',
 *         },
 *       ],
 *     },
 *   ],
 */

/**
 * Returns a human-readable display name for a JSX element's opening-tag name.
 *
 * @param {import('eslint').Rule.NodeTypes['JSXOpeningElement']['name']} nameNode
 * @returns {string}
 */
function getDisplayName(nameNode) {
  if (nameNode.type === 'JSXMemberExpression') {
    return `${nameNode.object.name}.${nameNode.property.name}`;
  }
  if (nameNode.type === 'JSXIdentifier') {
    return nameNode.name;
  }
  return '?';
}

/**
 * Builds the "use these instead" hint from the allowed config entries.
 *
 * @param {Array<{type: string, source: string, objectName?: string, names?: string[]}>} allowedConfig
 * @returns {string}  e.g. "MenuComponents.* from '@sentry/scraps/compactSelect', or Flex, Stack from '@sentry/scraps/layout'"
 */
function buildAllowedHint(allowedConfig) {
  const parts = allowedConfig.map(entry => {
    if (entry.type === 'member') {
      return `${entry.objectName}.* from '${entry.source}'`;
    }
    return `${entry.names.join(', ')} from '${entry.source}'`;
  });
  return parts.join(', or ');
}

/**
 * @type {import('eslint').Rule.RuleModule}
 */
export const restrictJsxSlotChildren = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Restrict JSX slot props to a configurable set of allowed elements.',
      recommended: false,
    },
    schema: [
      {
        type: 'object',
        properties: {
          /**
           * Names of the JSX props that act as "slots" and should be checked.
           * E.g. ["menuHeaderTrailingItems", "menuFooter"]
           */
          propNames: {
            type: 'array',
            items: {type: 'string'},
          },
          /**
           * Allowed element descriptors.  Each descriptor specifies where the
           * element comes from, what it looks like in JSX, and how the rule
           * should treat it when walking the tree.
           */
          allowed: {
            type: 'array',
            minItems: 1,
            items: {
              anyOf: [
                {
                  /**
                   * "member" — allows <Object.Member> when Object was imported
                   * as `objectName` from `source`.
                   */
                  type: 'object',
                  properties: {
                    type: {const: 'member'},
                    source: {type: 'string'},
                    objectName: {type: 'string'},
                    role: {type: 'string', enum: ['leaf', 'wrapper']},
                  },
                  required: ['type', 'source', 'objectName', 'role'],
                  additionalProperties: false,
                },
                {
                  /**
                   * "named" — allows <Ident> when Ident was imported from
                   * `source` as one of the listed `names`.
                   */
                  type: 'object',
                  properties: {
                    type: {const: 'named'},
                    source: {type: 'string'},
                    names: {
                      type: 'array',
                      minItems: 1,
                      items: {type: 'string'},
                    },
                    role: {type: 'string', enum: ['leaf', 'wrapper']},
                  },
                  required: ['type', 'source', 'names', 'role'],
                  additionalProperties: false,
                },
              ],
            },
          },
        },
        required: ['propNames', 'allowed'],
        additionalProperties: false,
      },
    ],
    messages: {
      forbidden: "<{{name}}> is not allowed in '{{prop}}'. Use: {{allowed}}.",
    },
  },

  create(context) {
    const options = context.options[0] ?? {propNames: [], allowed: []};
    const slotProps = new Set(options.propNames);
    const allowedConfig = options.allowed;

    // Pre-compute the hint string once per rule invocation (same config for
    // the whole file).
    const allowedHint = buildAllowedHint(allowedConfig);

    /**
     * Maps local binding name → role for "member"-type entries.
     * Populated as we visit ImportDeclarations.
     * Key: local name of the imported object (e.g. "MC" if aliased).
     * Value: "leaf" | "wrapper"
     *
     * @type {Map<string, 'leaf'|'wrapper'>}
     */
    const memberRoles = new Map();

    /**
     * Maps local binding name → role for "named"-type entries.
     * Key: local name of the imported identifier (e.g. "FlexLayout" if aliased).
     * Value: "leaf" | "wrapper"
     *
     * @type {Map<string, 'leaf'|'wrapper'>}
     */
    const namedRoles = new Map();

    /**
     * Returns the role of a JSX element name node, or null if the element is
     * not in any allowed set.
     *
     * @param {import('eslint').Rule.NodeTypes['JSXOpeningElement']['name']} nameNode
     * @returns {'leaf'|'wrapper'|null}
     */
    function getRole(nameNode) {
      if (
        nameNode.type === 'JSXMemberExpression' &&
        nameNode.object.type === 'JSXIdentifier'
      ) {
        return memberRoles.get(nameNode.object.name) ?? null;
      }
      if (nameNode.type === 'JSXIdentifier') {
        return namedRoles.get(nameNode.name) ?? null;
      }
      return null;
    }

    /**
     * Recursively walks a JSXElement against the slot rules:
     *   "leaf"    → allowed, stop recursing
     *   "wrapper" → allowed, recurse into direct JSX children
     *   null      → report
     *
     * @param {import('eslint').Rule.NodeTypes['JSXElement']} jsxElement
     * @param {string} propName
     */
    function checkSlotTree(jsxElement, propName) {
      const nameNode = jsxElement.openingElement.name;
      const role = getRole(nameNode);

      if (role === 'leaf') {
        return;
      }

      if (role === 'wrapper') {
        for (const child of jsxElement.children) {
          if (child.type === 'JSXElement') {
            checkSlotTree(child, propName);
          } else if (child.type === 'JSXExpressionContainer') {
            checkExpression(child.expression, propName);
          }
        }
        return;
      }

      context.report({
        node: jsxElement,
        messageId: 'forbidden',
        data: {name: getDisplayName(nameNode), prop: propName, allowed: allowedHint},
      });
    }

    /**
     * Unwraps ternary / logical expressions to find JSX elements, then checks
     * each one with checkSlotTree.
     *
     * @param {import('eslint').Rule.Node} expr
     * @param {string} propName
     */
    function checkExpression(expr, propName) {
      if (!expr) return;

      if (expr.type === 'JSXElement') {
        checkSlotTree(expr, propName);
        return;
      }

      // condition ? <A/> : <B/>
      if (expr.type === 'ConditionalExpression') {
        checkExpression(expr.consequent, propName);
        checkExpression(expr.alternate, propName);
        return;
      }

      // condition && <A/>  /  condition || <A/>
      if (expr.type === 'LogicalExpression') {
        if (expr.operator === '&&') {
          checkExpression(expr.right, propName);
        } else if (expr.operator === '||') {
          checkExpression(expr.left, propName);
          checkExpression(expr.right, propName);
        }
        return;
      }

      // null, false, string literals, identifiers, etc. — nothing to check
    }

    return {
      ImportDeclaration(node) {
        const source = node.source.value;

        for (const entry of allowedConfig) {
          if (entry.source !== source) continue;

          for (const spec of node.specifiers) {
            if (spec.type !== 'ImportSpecifier') continue;

            if (entry.type === 'member' && spec.imported.name === entry.objectName) {
              memberRoles.set(spec.local.name, entry.role);
            } else if (
              entry.type === 'named' &&
              entry.names.includes(spec.imported.name)
            ) {
              namedRoles.set(spec.local.name, entry.role);
            }
          }
        }
      },

      JSXAttribute(node) {
        const propName = node.name.type === 'JSXIdentifier' ? node.name.name : null;

        if (!propName || !slotProps.has(propName)) {
          return;
        }

        if (!node.value || node.value.type !== 'JSXExpressionContainer') {
          return;
        }

        const expr = node.value.expression;

        // Arrow / function with expression body: slotProp={() => <SomeElement>}
        // Block-body callbacks are intentionally not checked (see rule docs).
        if (
          (expr.type === 'ArrowFunctionExpression' ||
            expr.type === 'FunctionExpression') &&
          expr.body.type === 'JSXElement'
        ) {
          checkExpression(expr.body, propName);
          return;
        }

        // Direct JSX, conditional/logical expressions — checkExpression handles
        // all of these. Variable references and non-JSX values are ignored.
        checkExpression(expr, propName);
      },
    };
  },
};
