import {ESLintUtils, type TSESTree} from '@typescript-eslint/utils';
import {getParserServices} from '@typescript-eslint/utils/eslint-utils';
import ts from 'typescript';

export const noUnnecessaryTypeNarrowing = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow `as T` type assertions that narrow unnecessarily when the original type is already assignable to the contextual target type',
    },
    fixable: 'code',
    schema: [],
    messages: {
      unnecessary:
        'Type assertion is unnecessary: the original type is already assignable to the expected type.',
    },
  },
  create(context) {
    const parserServices = getParserServices(context);
    const checker = parserServices.program.getTypeChecker();

    function typeContainsAny(type: ts.Type, seen = new Set<ts.Type>()): boolean {
      if ((type.flags & ts.TypeFlags.Any) !== 0) {
        return true;
      }
      if (seen.has(type)) {
        return false;
      }
      seen.add(type);
      // Check type arguments (e.g. Promise<any>, Array<any>)
      const typeArgs = checker.getTypeArguments(type as ts.TypeReference);
      if (typeArgs?.length) {
        return typeArgs.some(arg => typeContainsAny(arg, seen));
      }
      // Check union/intersection members
      if (type.isUnionOrIntersection()) {
        return type.types.some(t => typeContainsAny(t, seen));
      }
      return false;
    }

    function isArgumentToGenericCall(node: TSESTree.TSAsExpression): boolean {
      // Walk up: the assertion might be inside an object literal property
      // that is an argument to a call, e.g. fn({ x: val as T })
      let current: TSESTree.Node = node;
      while (current.parent) {
        // eslint-disable-next-line @sentry/no-unnecessary-type-annotation -- breaks circular inference from `current = parent`
        const parent: TSESTree.Node = current.parent;
        if (
          parent.type === 'CallExpression' &&
          parent.arguments.includes(current as TSESTree.CallExpressionArgument)
        ) {
          // Found the call — check if it has explicit type arguments
          if (parent.typeArguments && parent.typeArguments.params.length > 0) {
            return false;
          }
          // Check if the callee has generic call signatures
          const calleeTsNode = parserServices.esTreeNodeToTSNodeMap.get(parent.callee);
          const calleeType = checker.getTypeAtLocation(calleeTsNode);
          const callSignatures = calleeType.getCallSignatures();
          return callSignatures.some(sig => {
            const typeParams = sig.getTypeParameters();
            return typeParams && typeParams.length > 0;
          });
        }
        // Keep walking through object/array literals and properties
        if (
          parent.type === 'Property' ||
          parent.type === 'ObjectExpression' ||
          parent.type === 'ArrayExpression' ||
          parent.type === 'SpreadElement'
        ) {
          current = parent;
          continue;
        }
        break;
      }
      return false;
    }

    function isInsideObjectProperty(node: TSESTree.TSAsExpression): boolean {
      let current: TSESTree.Node = node;
      while (current.parent) {
        // eslint-disable-next-line @sentry/no-unnecessary-type-annotation -- breaks circular inference from `current = parent`
        const parent: TSESTree.Node = current.parent;
        if (parent.type === 'Property') {
          return true;
        }
        // Walk through transparent expression wrappers
        if (
          parent.type === 'ConditionalExpression' ||
          parent.type === 'LogicalExpression' ||
          parent.type === 'SequenceExpression'
        ) {
          current = parent;
          continue;
        }
        break;
      }
      return false;
    }

    return {
      TSAsExpression(node: TSESTree.TSAsExpression) {
        // Skip `as const` — always valid
        if (
          node.typeAnnotation.type === 'TSTypeReference' &&
          node.typeAnnotation.typeName.type === 'Identifier' &&
          node.typeAnnotation.typeName.name === 'const'
        ) {
          return;
        }

        // Skip assertions to any/unknown (escape hatches)
        const assertedType = parserServices.getTypeFromTypeNode(node.typeAnnotation);
        if (
          (assertedType.flags &
            (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)) !==
          0
        ) {
          return;
        }

        // Skip double assertions like `as unknown as T` / `as any as T`
        // These are deliberate escape hatches via an intermediate widening type
        if (node.expression.type === 'TSAsExpression') {
          const innerAssertedType = parserServices.getTypeFromTypeNode(
            node.expression.typeAnnotation
          );
          if (
            (innerAssertedType.flags &
              (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)) !==
            0
          ) {
            return;
          }
        }

        // Skip assertions on object and array literals — these are contextually
        // typed by the assertion itself, so getTypeAtLocation reports the
        // narrowed type. Without the assertion, object properties widen
        // (`'foo'` → `string`), arrays widen (`[a, b]` → `(A|B)[]` not tuples),
        // and literal types are lost.
        if (
          node.expression.type === 'ObjectExpression' ||
          node.expression.type === 'ArrayExpression'
        ) {
          return;
        }

        // Skip assertions that narrow away from `any` — these add type safety.
        // Check recursively through type arguments to catch cases like
        // `Promise<any>` being asserted to `Promise<TableData>`.
        const originalTsNode = parserServices.esTreeNodeToTSNodeMap.get(node.expression);
        const originalType = checker.getTypeAtLocation(originalTsNode);
        if (typeContainsAny(originalType)) {
          return;
        }

        // Skip assertions that narrow a primitive to literal types — the
        // assertion provides precision the type system cannot infer on its own
        // (e.g. template literals produce `string`, but `as 'a' | 'b'` narrows
        // to specific values).
        const primitiveFlags =
          ts.TypeFlags.String |
          ts.TypeFlags.Number |
          ts.TypeFlags.Boolean |
          ts.TypeFlags.BigInt;
        if (
          (originalType.flags & primitiveFlags) !== 0 &&
          checker.isTypeAssignableTo(assertedType, originalType) &&
          !checker.isTypeAssignableTo(originalType, assertedType)
        ) {
          return;
        }

        // Skip assertions in variable assignments and declarations — narrowing
        // in assignments (e.g. `dom = dom as HTMLDivElement`) is intentional
        // and out of scope for this rule.
        if (
          node.parent?.type === 'VariableDeclarator' ||
          node.parent?.type === 'AssignmentExpression'
        ) {
          return;
        }

        // Skip assertions inside spread elements — the spread operator requires
        // an object type (TS2698), so the assertion may be structurally necessary
        // even when the original type is assignable to the contextual type.
        if (node.parent?.type === 'SpreadElement') {
          return;
        }

        // Skip assertions inside object literal properties — property values
        // are contextually typed, so removing the assertion can widen the type
        // (e.g. `'foo' as SomeUnion` becomes `string` without the assertion).
        // Walk up through transparent expression wrappers (ternaries, logical
        // expressions, etc.) to find the enclosing property.
        if (isInsideObjectProperty(node)) {
          return;
        }

        // Skip assertions that are arguments to generic function calls without
        // explicit type arguments — the assertion participates in type inference
        // for the generic, so removing it would change the inferred types.
        if (isArgumentToGenericCall(node)) {
          return;
        }

        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);

        // Get the contextual type — what the surrounding context expects
        const contextualType = checker.getContextualType(tsNode);
        if (!contextualType) {
          return;
        }

        // If the original type is already assignable to the contextual type,
        // the narrowing assertion is unnecessary
        if (checker.isTypeAssignableTo(originalType, contextualType)) {
          context.report({
            node: node.typeAnnotation,
            messageId: 'unnecessary',
            fix(fixer) {
              // Remove ` as Type` — find the `as` keyword in the source to avoid
              // eating closing parens between the expression and `as`, e.g.
              // `({...obj}) as T` should become `({...obj})`, not `({...obj}`
              const source = context.sourceCode.getText();
              const searchStart = node.expression.range[1];
              const asIndex = source.indexOf(' as ', searchStart);
              if (asIndex === -1) {
                return null;
              }
              return fixer.removeRange([asIndex, node.range[1]]);
            },
          });
        }
      },
    };
  },
});
