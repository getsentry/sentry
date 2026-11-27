import {defineRule, type ESTree} from '@oxlint/plugins';

// Roles whose widgets mark their state with aria-disabled instead of the native
// disabled attribute. jest-dom's toBeEnabled()/toBeDisabled() only read the
// native attribute, so on these elements toBeEnabled() always passes and
// toBeDisabled() always fails.
const ARIA_DISABLED_ROLES = new Set([
  'gridcell',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'row',
  'tab',
  'treeitem',
]);
const SINGLE_QUERIES = new Set(['getByRole', 'queryByRole', 'findByRole']);
const ALL_QUERIES = new Set(['getAllByRole', 'queryAllByRole', 'findAllByRole']);
const MATCHERS = new Set(['toBeEnabled', 'toBeDisabled']);

function propertyName(node: ESTree.Node): string | null {
  return node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier'
    ? node.property.name
    : null;
}

function calleeName(node: ESTree.CallExpression): string | null {
  return node.callee.type === 'Identifier' ? node.callee.name : propertyName(node.callee);
}

// Strips `await`, non-null assertions and `as` casts, e.g. `(await findAllByRole('row'))[0]!`.
function unwrap(node: ESTree.Node): ESTree.Node {
  let current = node;
  while (
    current.type === 'AwaitExpression' ||
    current.type === 'TSNonNullExpression' ||
    current.type === 'TSAsExpression'
  ) {
    current = current.type === 'AwaitExpression' ? current.argument : current.expression;
  }
  return current;
}

function queriedRole(node: ESTree.Node, queries: Set<string>): string | null {
  if (node.type !== 'CallExpression') {
    return null;
  }
  const name = calleeName(node);
  const role = node.arguments[0];
  return name &&
    queries.has(name) &&
    role?.type === 'Literal' &&
    typeof role.value === 'string' &&
    ARIA_DISABLED_ROLES.has(role.value)
    ? role.value
    : null;
}

export const preferAriaDisabledAssertion = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow toBeEnabled() and toBeDisabled() on roles that mark their state with aria-disabled.',
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      preferAriaDisabledAssertion:
        "{{matcher}}() only checks the native disabled attribute, but '{{role}}' elements are disabled with aria-disabled, so this assertion ignores its state. Use .not.toHaveAttribute('aria-disabled', 'true') for enabled or .toHaveAttribute('aria-disabled', 'true') for disabled. For an <option> in a native <select>, toBeDisabled() works: add // oxlint-disable-next-line @sentry/prefer-aria-disabled-assertion.",
      useAriaDisabled: 'Replace with {{replacement}}.',
    },
  },
  create(context) {
    function binding(node: ESTree.IdentifierReference | ESTree.BindingIdentifier) {
      let scope: ReturnType<typeof context.sourceCode.getScope> | null =
        context.sourceCode.getScope(node);
      while (scope) {
        const variable = scope.set.get(node.name);
        if (variable) {
          return variable;
        }
        scope = scope.upper;
      }
      return null;
    }

    // Follows wrappers stripped by unwrap() and const variables back to the expression they hold.
    function resolve(node: ESTree.Node, seen = new Set<ESTree.Node>()): ESTree.Node {
      const subject = unwrap(node);
      if (subject.type !== 'Identifier' || seen.has(subject)) {
        return subject;
      }
      seen.add(subject);
      const definition = binding(subject)?.defs[0];
      if (
        definition?.node.type === 'VariableDeclarator' &&
        definition.parent?.type === 'VariableDeclaration' &&
        definition.parent.kind === 'const' &&
        definition.node.id.type === 'Identifier' &&
        definition.node.init
      ) {
        return resolve(definition.node.init, seen);
      }
      return subject;
    }

    // shortcut: only inline role queries and const variables assigned from them are traced, extend when helpers that return these roles are asserted on.
    function roleOf(node: ESTree.Node): string | null {
      const subject = resolve(node);
      // screen.getAllByRole('option')[0]
      if (subject.type === 'MemberExpression' && subject.computed) {
        return queriedRole(resolve(subject.object), ALL_QUERIES);
      }
      // screen.getAllByRole('option').at(0)
      if (
        subject.type === 'CallExpression' &&
        subject.callee.type === 'MemberExpression' &&
        propertyName(subject.callee) === 'at'
      ) {
        return queriedRole(resolve(subject.callee.object), ALL_QUERIES);
      }
      return queriedRole(subject, SINGLE_QUERIES);
    }

    return {
      CallExpression(node) {
        const matcher = propertyName(node.callee);
        if (
          !matcher ||
          !MATCHERS.has(matcher) ||
          node.callee.type !== 'MemberExpression'
        ) {
          return;
        }
        const negated = propertyName(node.callee.object) === 'not';
        const expectCall =
          negated && node.callee.object.type === 'MemberExpression'
            ? node.callee.object.object
            : node.callee.object;
        if (
          expectCall.type !== 'CallExpression' ||
          expectCall.callee.type !== 'Identifier' ||
          expectCall.callee.name !== 'expect' ||
          !expectCall.arguments[0]
        ) {
          return;
        }
        const role = roleOf(expectCall.arguments[0]);
        if (!role) {
          return;
        }
        const assertsEnabled = (matcher === 'toBeEnabled') !== negated;
        const replacement = assertsEnabled
          ? ".not.toHaveAttribute('aria-disabled', 'true')"
          : ".toHaveAttribute('aria-disabled', 'true')";
        context.report({
          node,
          messageId: 'preferAriaDisabledAssertion',
          data: {matcher, role},
          suggest: [
            {
              messageId: 'useAriaDisabled',
              data: {replacement},
              fix: fixer =>
                fixer.replaceTextRange([expectCall.range[1], node.range[1]], replacement),
            },
          ],
        });
      },
    };
  },
});
