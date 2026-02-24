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
 *   - Member expressions (<A.B>) are treated as leaves — the rule stops here.
 *   - Plain identifiers (<Ident>) are treated as wrappers — the rule recurses
 *     into their direct JSX children and checks each one.
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
 * Pre-processes a single allowed entry's names into member and identifier sets.
 *
 * @param {Array<string>} names
 * @returns {{ memberNames: Map<string, Set<string>>, identifierNames: Set<string> }}
 */
function processNames(names) {
  /** @type {Map<string, Set<string>>} */
  const memberNames = new Map();
  /** @type {Set<string>} */
  const identifierNames = new Set();

  for (const name of names) {
    const dot = name.indexOf('.');
    if (dot === -1) {
      identifierNames.add(name);
    } else {
      const obj = name.slice(0, dot);
      const member = name.slice(dot + 1);
      const members = memberNames.get(obj);
      if (members) {
        members.add(member);
      } else {
        memberNames.set(obj, new Set([member]));
      }
    }
  }

  return {memberNames, identifierNames};
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
     * processedAllowed: pre-parsed config entries for fast import lookup
     * memberAllowed:    localAlias → Set<memberName>  (leaf: stop recursion)
     * namedAllowed:     Set<localAlias>               (wrapper: recurse)
     * hint:             pre-computed error hint string
     */
    const slotState = new Map();

    for (const slot of slotsConfig) {
      /** @type {Array<{source: string, names: string[]}>} */
      const allowed = slot.allowed;
      const state = {
        processedAllowed: allowed.map(entry => ({
          source: entry.source,
          ...processNames(entry.names),
        })),
        memberAllowed: new Map(),
        namedAllowed: new Set(),
        hint: buildAllowedHint(allowed),
      };
      for (const propName of slot.propNames) {
        slotState.set(propName, state);
      }
    }

    /**
     * Recursively walks a JSXElement against a slot's allowed set:
     *
     *   - Member expression (<A.B>) where A is a tracked alias and B is in its
     *     allowed member set: leaf, stop.
     *   - Identifier (<Ident>) where Ident is in namedAllowed: wrapper, recurse.
     *   - Anything else: reported as forbidden.
     *
     * @param {*} jsxElement
     * @param {string} propName
     * @param {{memberAllowed: Map<string, Set<string>>, namedAllowed: Set<string>, hint: string}} state
     */
    function checkSlotTree(jsxElement, propName, state) {
      const nameNode = jsxElement.openingElement.name;

      if (
        nameNode.type === 'JSXMemberExpression' &&
        nameNode.object.type === 'JSXIdentifier'
      ) {
        const allowedMembers = state.memberAllowed.get(nameNode.object.name);
        if (allowedMembers?.has(nameNode.property.name)) {
          return; // leaf — don't recurse into children
        }
      } else if (
        nameNode.type === 'JSXIdentifier' &&
        state.namedAllowed.has(nameNode.name)
      ) {
        // wrapper — recurse into direct JSX children
        for (const child of jsxElement.children) {
          if (child.type === 'JSXElement') {
            checkSlotTree(child, propName, state);
          } else if (child.type === 'JSXExpressionContainer') {
            checkExpression(child.expression, propName, state);
          }
        }
        return;
      }

      context.report({
        node: jsxElement,
        messageId: 'forbidden',
        data: {name: getDisplayName(nameNode), prop: propName, allowed: state.hint},
      });
    }

    /**
     * Unwraps ternary / logical expressions to find JSX elements, then checks
     * each one with checkSlotTree.
     *
     * @param {*} expr
     * @param {string} propName
     * @param {{memberAllowed: Map<string, Set<string>>, namedAllowed: Set<string>, hint: string}} state
     */
    function checkExpression(expr, propName, state) {
      if (!expr) return;

      if (expr.type === 'JSXElement') {
        checkSlotTree(expr, propName, state);
        return;
      }

      // condition ? <A/> : <B/>
      if (expr.type === 'ConditionalExpression') {
        checkExpression(expr.consequent, propName, state);
        checkExpression(expr.alternate, propName, state);
        return;
      }

      // condition && <A/>  /  condition || <A/>
      if (expr.type === 'LogicalExpression') {
        if (expr.operator === '&&') {
          checkExpression(expr.right, propName, state);
        } else if (expr.operator === '||') {
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

              const memberNames = entry.memberNames.get(importedName);
              if (memberNames) {
                const existing = state.memberAllowed.get(localName);
                if (existing) {
                  for (const m of memberNames) existing.add(m);
                } else {
                  state.memberAllowed.set(localName, new Set(memberNames));
                }
              }

              if (entry.identifierNames.has(importedName)) {
                state.namedAllowed.add(localName);
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
          checkExpression(expr.body, propName, state);
          return;
        }

        checkExpression(expr, propName, state);
      },
    };
  },
};
