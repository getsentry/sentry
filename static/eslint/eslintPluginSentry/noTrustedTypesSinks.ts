import type {TSESLint, TSESTree} from '@typescript-eslint/utils';
import {AST_NODE_TYPES, ESLintUtils} from '@typescript-eslint/utils';
import {DefinitionType} from '@typescript-eslint/scope-manager';

/**
 * Functions that return a value already run through a sanitizer, so their
 * result is safe to hand to an injection sink. Keep this list short — every
 * entry is a promise that the function sanitizes, not merely that its current
 * callers happen to pass safe input.
 */
const SANITIZERS = new Set([
  'sanitizeHtml',
  'sanitizedMarked',
  'asyncSanitizedMarked',
  'singleLineRenderer',
]);

/** Member calls treated as sanitizers, matched on the property name. */
const SANITIZER_METHODS = new Set(['sanitize']);

/** `el.<name> = value` */
const ASSIGNMENT_SINKS = new Set(['innerHTML', 'outerHTML', 'srcdoc']);

/** Sinks only when the element is a `<script>`; see the comment at the use site. */
const SCRIPT_SINKS = new Set(['textContent', 'text', 'innerText', 'src']);

/** `el.<name>(value)` */
const CALL_SINKS = new Set([
  'insertAdjacentHTML',
  'createContextualFragment',
  'setHTMLUnsafe',
  'parseFromString',
  'write',
  'writeln',
]);

function isSanitizerCall(node: TSESTree.Node | null | undefined): boolean {
  if (node?.type !== AST_NODE_TYPES.CallExpression) {
    return false;
  }
  const {callee} = node;
  if (callee.type === AST_NODE_TYPES.Identifier) {
    return SANITIZERS.has(callee.name);
  }
  if (
    callee.type === AST_NODE_TYPES.MemberExpression &&
    callee.property.type === AST_NODE_TYPES.Identifier
  ) {
    return SANITIZER_METHODS.has(callee.property.name);
  }
  return false;
}

/**
 * Resolve an identifier back to a single `const x = sanitizeHtml(...)` in
 * scope. Deliberately shallow: one definition, one initializer. Anything less
 * obvious should be explicit at the call site rather than inferred here.
 */
function resolvesToSanitizer(
  node: TSESTree.Node,
  scope: TSESLint.Scope.Scope | null
): boolean {
  if (node.type !== AST_NODE_TYPES.Identifier) {
    return false;
  }
  for (let current = scope; current; current = current.upper) {
    const variable = current.variables.find(v => v.name === node.name);
    if (!variable) {
      continue;
    }
    if (variable.defs.length !== 1) {
      return false;
    }
    const def = variable.defs[0]!;
    return (
      def.type === DefinitionType.Variable &&
      def.parent.kind === 'const' &&
      isSanitizerCall(def.node.init)
    );
  }
  return false;
}

export const noTrustedTypesSinks = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow writing unsanitized values to Trusted Types injection sinks',
    },
    schema: [],
    messages: {
      jsxSink:
        'dangerouslySetInnerHTML is a Trusted Types injection sink. Pass a value from a sanitizer (sanitizeHtml, singleLineRenderer, sanitizedMarked, or DOMPurify.sanitize with RETURN_TRUSTED_TYPE), or render the content as JSX instead.',
      assignmentSink:
        'Assigning to `{{name}}` is a Trusted Types injection sink. Build DOM nodes instead (createElement / createTextNode / createComment / replaceChildren), or assign a value from a sanitizer.',
      callSink:
        '`{{name}}` is a Trusted Types injection sink. Build DOM nodes instead, or pass a value from a sanitizer.',
      scriptSink:
        'Writing to a script element is a Trusted Types injection sink. Use `script.appendChild(document.createTextNode(...))`, which is not a sink.',
    },
  },
  create(context) {
    function isSafe(node: TSESTree.Node | null | undefined): boolean {
      if (!node) {
        return false;
      }
      if (isSanitizerCall(node)) {
        return true;
      }
      return resolvesToSanitizer(node, context.sourceCode.getScope(node));
    }

    return {
      JSXAttribute(node) {
        if (
          node.name.type !== AST_NODE_TYPES.JSXIdentifier ||
          node.name.name !== 'dangerouslySetInnerHTML' ||
          node.value?.type !== AST_NODE_TYPES.JSXExpressionContainer
        ) {
          return;
        }

        const {expression} = node.value;

        // An inline object is the only shape we can judge statically. Anything
        // else — `{...getHelp()}`, a spread, an identifier — hides the value, so
        // it has to be reported rather than assumed safe.
        if (expression.type !== AST_NODE_TYPES.ObjectExpression) {
          context.report({node, messageId: 'jsxSink'});
          return;
        }

        const html = expression.properties.find(
          (p): p is TSESTree.Property =>
            p.type === AST_NODE_TYPES.Property &&
            p.key.type === AST_NODE_TYPES.Identifier &&
            p.key.name === '__html'
        );

        // A spread (`{...obj}`) also hides `__html`.
        const hasSpread = expression.properties.some(
          p => p.type === AST_NODE_TYPES.SpreadElement
        );

        if (!html) {
          if (hasSpread) {
            context.report({node, messageId: 'jsxSink'});
          }
          return;
        }

        if (!isSafe(html.value)) {
          context.report({node, messageId: 'jsxSink'});
        }
      },

      AssignmentExpression(node) {
        const {left} = node;
        if (
          left.type !== AST_NODE_TYPES.MemberExpression ||
          left.property.type !== AST_NODE_TYPES.Identifier
        ) {
          return;
        }

        const name = left.property.name;

        // `textContent` / `text` / `innerText` / `src` are only sinks on
        // <script>, which we cannot detect without type information — `img.src`
        // is fine. Fall back to flagging when the object is *named* like a
        // script element, which covers the realistic `createElement('script')`
        // pattern without drowning every `img.src = url` in false positives.
        if (
          SCRIPT_SINKS.has(name) &&
          left.object.type === AST_NODE_TYPES.Identifier &&
          /script/i.test(left.object.name)
        ) {
          context.report({node, messageId: 'scriptSink'});
          return;
        }

        if (ASSIGNMENT_SINKS.has(name) && !isSafe(node.right)) {
          context.report({node, messageId: 'assignmentSink', data: {name}});
        }
      },

      CallExpression(node) {
        const {callee} = node;
        if (
          callee.type !== AST_NODE_TYPES.MemberExpression ||
          callee.property.type !== AST_NODE_TYPES.Identifier
        ) {
          return;
        }

        const name = callee.property.name;
        if (!CALL_SINKS.has(name)) {
          return;
        }

        // `write`/`writeln` are only sinks on a document.
        if (name === 'write' || name === 'writeln') {
          const obj = callee.object;
          const isDocument =
            (obj.type === AST_NODE_TYPES.Identifier && obj.name === 'document') ||
            (obj.type === AST_NODE_TYPES.MemberExpression &&
              obj.property.type === AST_NODE_TYPES.Identifier &&
              obj.property.name === 'document');
          if (!isDocument) {
            return;
          }
        }

        const value = name === 'insertAdjacentHTML' ? node.arguments[1] : node.arguments[0];
        if (!isSafe(value)) {
          context.report({node, messageId: 'callSink', data: {name}});
        }
      },
    };
  },
});
