import {ESLintUtils, type TSESTree} from '@typescript-eslint/utils';
import {getParserServices} from '@typescript-eslint/utils/eslint-utils';
import ts from 'typescript';

export const noUnnecessaryTypeAnnotation = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow type annotations that match the inferred type',
    },
    fixable: 'code',
    schema: [],
    messages: {
      unnecessary: 'Type annotation is unnecessary — TypeScript infers the same type.',
    },
  },
  create(context) {
    const parserServices = getParserServices(context);

    const checker = parserServices.program.getTypeChecker();

    function typesAreIdentical(a: ts.Type, b: ts.Type): boolean {
      if (!checker.isTypeAssignableTo(a, b) || !checker.isTypeAssignableTo(b, a)) {
        return false;
      }
      // Bidirectional assignability doesn't guarantee identity when optional
      // properties differ — e.g. `A & B` vs `A & B & { extra?: string }`.
      // Verify both types expose the same set of properties.
      const propsA = checker.getPropertiesOfType(a);
      const propsB = checker.getPropertiesOfType(b);
      if (propsA.length !== propsB.length) {
        return false;
      }
      const namesA = new Set(propsA.map(p => p.name));
      if (!propsB.every(p => namesA.has(p.name))) {
        return false;
      }
      // Also compare index signatures — e.g. Record<string, Tag> ({} with a
      // string index) vs plain {} are bidirectionally assignable with identical
      // named properties, but the annotation adds the index signature.
      const indexA = checker.getIndexInfosOfType(a);
      const indexB = checker.getIndexInfosOfType(b);
      if (indexA.length !== indexB.length) {
        return false;
      }
      return true;
    }

    function isEscapeHatch(type: ts.Type): boolean {
      return (
        (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)) !==
        0
      );
    }

    /**
     * Returns true if the type contains `any` at any level, including
     * within type arguments (e.g. Promise<any>, Array<any>, Map<string, any>).
     */
    function containsAny(type: ts.Type): boolean {
      if ((type.flags & ts.TypeFlags.Any) !== 0) {
        return true;
      }
      const typeArgs = checker.getTypeArguments(type as ts.TypeReference);
      if (typeArgs) {
        return typeArgs.some(arg => containsAny(arg));
      }
      return false;
    }

    /**
     * Returns true if the AST node contains an arrow/function expression
     * with untyped parameters at any relevant nesting level. Use visitor keys
     * so that nested functions in expression forms are included. Block-bodied
     * functions are not traversed because their local functions are not
     * contextually typed by the enclosing variable annotation.
     */
    function containsUntypedFunction(node: TSESTree.Node): boolean {
      if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
        if (
          node.params.some(param => !('typeAnnotation' in param) || !param.typeAnnotation)
        ) {
          return true;
        }
        if (node.body.type === 'BlockStatement') {
          return false;
        }
      }

      const keys = context.sourceCode.visitorKeys[node.type] ?? [];
      for (const key of keys) {
        const child = node[key as keyof typeof node] as
          | TSESTree.Node
          | TSESTree.Node[]
          | null
          | undefined;
        if (Array.isArray(child)) {
          if (
            child.some(
              item => item !== null && item !== undefined && containsUntypedFunction(item)
            )
          ) {
            return true;
          }
        } else if (child && containsUntypedFunction(child)) {
          return true;
        }
      }
      return false;
    }

    return {
      VariableDeclarator(node) {
        // Only const/let declarations (skip var)
        if (node.parent.kind !== 'const' && node.parent.kind !== 'let') {
          return;
        }

        // Only simple identifiers (skip destructuring)
        if (node.id.type !== 'Identifier') {
          return;
        }

        // Must have both annotation and initializer
        if (!node.id.typeAnnotation || !node.init) {
          return;
        }

        // Skip object/array literals — `prefer-satisfies-for-objects` handles these.
        if (
          node.init.type === 'ObjectExpression' ||
          node.init.type === 'ArrayExpression'
        ) {
          return;
        }

        // Skip any initializer that contains an arrow/function expression with
        // untyped parameters. The annotation provides contextual typing that
        // would be lost without it (params become `any`). This covers direct
        // functions, ternaries, logical expressions, and call expression args.
        if (containsUntypedFunction(node.init)) {
          return;
        }

        const annotationType = parserServices.getTypeFromTypeNode(
          node.id.typeAnnotation.typeAnnotation
        );
        if (isEscapeHatch(annotationType)) {
          return;
        }
        let inferredType = parserServices.getTypeAtLocation(node.init);
        // Skip type parameters (generics) — the annotation intentionally widens
        // from a generic to a concrete type (e.g. `let url: string = path` where
        // path is TApiPath extends string).
        if ((inferredType.flags & ts.TypeFlags.TypeParameter) !== 0) {
          return;
        }
        // For let declarations, TypeScript widens literal types (e.g. "" → string).
        // getTypeAtLocation returns the narrow literal type, so widen it to match
        // what TS would actually infer without the annotation.
        // Only widen single literal types, not unions — widening a union of string
        // literals to `string` is a real semantic change (e.g. generic constraints).
        if (
          node.parent.kind === 'let' &&
          (inferredType.flags & ts.TypeFlags.Union) === 0
        ) {
          inferredType = checker.getBaseTypeOfLiteralType(inferredType);
        }
        if (containsAny(inferredType)) {
          return;
        }

        if (typesAreIdentical(annotationType, inferredType)) {
          context.report({
            node: node.id.typeAnnotation,
            messageId: 'unnecessary',
            fix(fixer) {
              return fixer.remove(node.id.typeAnnotation!);
            },
          });
        }
      },
    };
  },
});
