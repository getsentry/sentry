/**
 * ESLint rule: restrict-jsx-slot-children
 *
 * Restricts the JSX trees passed to specific props ("slots") to a configurable
 * set of allowed elements. Each slot config is applied to one or more prop
 * names via `propNames`.
 *
 * Each allowed element descriptor lists the names that may appear in JSX and
 * where they are imported from:
 *
 *   { source, names }
 *     `names` is a flat list of allowed JSX tag names, using dot notation for
 *     member expressions. Plain names match <Ident>; dotted names match
 *     <Object.Member>. Import aliasing is respected.
 *
 * Recursion semantics:
 *   - Every element in the slot's JSX tree is checked against the allowed set.
 *   - Allowed elements always have their children checked recursively.
 *   - Disallowed elements are reported immediately (children are not checked).
 *
 * The rule handles direct JSX, arrow-function expression bodies, top-level
 * ternary / logical (&&, ||, ??) expressions, and JSXExpressionContainers
 * inside children.
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
 *       slots: [
 *         {
 *           propNames: ['menuHeaderTrailingItems', 'menuFooter'],
 *           allowed: [
 *             {
 *               source: '@sentry/scraps/compactSelect',
 *               names: [
 *                 'MenuComponents.HeaderButton',
 *                 'MenuComponents.CTAButton',
 *                 'MenuComponents.ApplyButton',
 *               ],
 *             },
 *             {
 *               source: '@sentry/scraps/layout',
 *               names: ['Flex', 'Stack', 'Grid', 'Container'],
 *             },
 *           ],
 *         },
 *       ],
 *     },
 *   ],
 */

/**
 * Returns true if the name node refers to a React fragment (<Fragment> or
 * <React.Fragment>). Fragments are always transparent wrappers — the rule
 * recurses into their children without checking the fragment element itself.
 *
 * @param {*} nameNode
 * @returns {boolean}
 */
function isReactFragment(nameNode) {
  if (nameNode.type === 'JSXIdentifier' && nameNode.name === 'Fragment') {
    return true;
  }
  if (
    nameNode.type === 'JSXMemberExpression' &&
    nameNode.object.type === 'JSXIdentifier' &&
    nameNode.object.name === 'React' &&
    nameNode.property.name === 'Fragment'
  ) {
    return true;
  }
  return false;
}

/**
 * Returns a human-readable display name for a JSX element's opening-tag name.
 *
 * @param {*} nameNode
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
 * Builds the "use these instead" hint string from an allowed-descriptor array.
 *
 * @param {Array<{source: string, names: string[]}>} allowedConfig
 * @returns {string}
 */
function buildAllowedHint(allowedConfig) {
  return allowedConfig
    .map(entry => `${entry.names.join(', ')} from '${entry.source}'`)
    .join(', or ');
}

/**
 * @type {import('eslint').Rule.RuleModule}
 */
export const restrictJsxSlotChildren = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Restrict JSX slot props to a per-prop configurable set of allowed elements.',
      recommended: false,
    },
    schema: [
      {
        type: 'object',
        properties: {
          slots: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                componentNames: {
                  type: 'array',
                  items: {type: 'string'},
                },
                propNames: {
                  type: 'array',
                  minItems: 1,
                  items: {type: 'string'},
                },
                allowed: {
                  type: 'array',
                  minItems: 1,
                  items: {
                    type: 'object',
                    properties: {
                      source: {type: 'string'},
                      names: {
                        type: 'array',
                        minItems: 1,
                        items: {type: 'string'},
                      },
                    },
                    required: ['source', 'names'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['propNames', 'allowed'],
              additionalProperties: false,
            },
          },
        },
        required: ['slots'],
        additionalProperties: false,
      },
    ],
    messages: {
      forbidden: "<{{name}}> is not allowed in '{{prop}}'. Use: {{allowed}}.",
    },
  },

  create(context) {
    const slotsConfig = context.options[0]?.slots ?? [];

    /**
     * Per-slot runtime state, keyed by individual prop name.
     *
     * processedAllowed: raw config entries used to resolve imports at runtime
     * allowedNames:     Set of resolved local display names (e.g. "Flex", "MC.Alert")
     * hint:             pre-computed error hint string
     * componentNames:   optional set of component names that restrict which
     *                   JSX elements this slot config applies to
     */
    const slotState = new Map();

    for (const slot of slotsConfig) {
      /** @type {Array<{source: string, names: string[]}>} */
      const allowed = slot.allowed;
      const state = {
        processedAllowed: allowed.map(entry => ({
          source: entry.source,
          names: entry.names,
        })),
        allowedNames: new Set(),
        hint: buildAllowedHint(allowed),
        componentNames: new Set(slot.componentNames ?? []),
      };
      for (const propName of slot.propNames) {
        if (slotState.has(propName)) {
          throw new TypeError(
            `Duplicate prop configuration for: ${propName} in slot ${slot.componentNames.join(', ')}`
          );
        }
        slotState.set(propName, state);
      }
    }

    /**
     * Recursively walks a JSXElement against a slot's allowed set.
     *
     * Every element is checked: if its display name is in `allowedNames` the
     * rule recurses into direct JSX children; otherwise the element is reported
     * as forbidden and recursion stops.
     *
     * @param {*} jsxElement
     * @param {string} propName
     * @param {{allowedNames: Set<string>, hint: string}} state
     */
    function checkSlotTree(jsxElement, propName, state) {
      const nameNode = jsxElement.openingElement.name;

      // React fragments are always transparent — skip the allowed check and
      // recurse directly into their children.
      if (!isReactFragment(nameNode)) {
        const displayName = getDisplayName(nameNode);
        if (!state.allowedNames.has(displayName)) {
          context.report({
            node: jsxElement,
            messageId: 'forbidden',
            data: {name: displayName, prop: propName, allowed: state.hint},
          });
          return;
        }
      }

      // recurse into direct JSX children
      for (const child of jsxElement.children) {
        if (child.type === 'JSXElement') {
          checkSlotTree(child, propName, state);
        } else if (child.type === 'JSXFragment') {
          checkExpression(child, propName, state);
        } else if (child.type === 'JSXExpressionContainer') {
          checkExpression(child.expression, propName, state);
        }
      }
    }

    /**
     * Unwraps ternary / logical expressions to find JSX elements, then checks
     * each one with checkSlotTree.
     *
     * @param {*} expr
     * @param {string} propName
     * @param {{allowedNames: Set<string>, hint: string}} state
     */
    function checkExpression(expr, propName, state) {
      if (!expr) return;

      if (expr.type === 'JSXElement') {
        checkSlotTree(expr, propName, state);
        return;
      }

      // shorthand fragment <> — recurse into children
      if (expr.type === 'JSXFragment') {
        for (const child of expr.children) {
          if (child.type === 'JSXElement') {
            checkSlotTree(child, propName, state);
          } else if (child.type === 'JSXFragment') {
            checkExpression(child, propName, state);
          } else if (child.type === 'JSXExpressionContainer') {
            checkExpression(child.expression, propName, state);
          }
        }
        return;
      }

      // condition ? <A/> : <B/>
      if (expr.type === 'ConditionalExpression') {
        checkExpression(expr.consequent, propName, state);
        checkExpression(expr.alternate, propName, state);
        return;
      }

      // condition && <A/>  /  condition || <A/>  /  condition ?? <A/>
      if (expr.type === 'LogicalExpression') {
        if (expr.operator === '&&') {
          checkExpression(expr.right, propName, state);
        } else if (expr.operator === '||' || expr.operator === '??') {
          checkExpression(expr.left, propName, state);
          checkExpression(expr.right, propName, state);
        }
        return;
      }

      // null, false, string literals, identifiers, etc. — nothing to check
    }

    return {
      ImportDeclaration(node) {
        const source = node.source.value;

        for (const [, state] of slotState) {
          for (const entry of state.processedAllowed) {
            if (entry.source !== source) continue;

            for (const spec of node.specifiers) {
              if (spec.type !== 'ImportSpecifier') continue;
              if (spec.imported.type !== 'Identifier') continue;

              const importedName = spec.imported.name;
              const localName = spec.local.name;

              for (const name of entry.names) {
                const dot = name.indexOf('.');
                if (dot === -1) {
                  // plain identifier: e.g. "Flex"
                  if (name === importedName) {
                    state.allowedNames.add(localName);
                  }
                } else {
                  // member expression: e.g. "MenuComponents.Alert"
                  const obj = name.slice(0, dot);
                  const member = name.slice(dot + 1);
                  if (obj === importedName) {
                    state.allowedNames.add(`${localName}.${member}`);
                  }
                }
              }
            }
          }
        }
      },

      JSXAttribute(node) {
        const propName = node.name.type === 'JSXIdentifier' ? node.name.name : null;
        if (!propName) return;

        const state = slotState.get(propName);
        if (!state) return;

        if (state.componentNames.size > 0) {
          const nameNode = node.parent.name; // JSXAttribute → JSXOpeningElement
          let elementName = null;
          if (nameNode.type === 'JSXIdentifier') {
            elementName = nameNode.name;
          } else if (nameNode.type === 'JSXMemberExpression') {
            elementName = `${nameNode.object.name}.${nameNode.property.name}`;
          }
          if (!elementName || !state.componentNames.has(elementName)) {
            return;
          }
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
          expr.body.type !== 'BlockStatement'
        ) {
          checkExpression(expr.body, propName, state);
          return;
        }

        checkExpression(expr, propName, state);
      },
    };
  },
};
