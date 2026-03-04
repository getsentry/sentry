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
     * with untyped parameters at any nesting level. Traverses through
     * ternaries, logical expressions, and call expression arguments.
     */
    function containsUntypedFunction(node: TSESTree.Node): boolean {
      if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
        return node.params.some(
          param => !('typeAnnotation' in param) || !param.typeAnnotation
        );
      }
      if (node.type === 'ConditionalExpression') {
        return (
          containsUntypedFunction(node.consequent) ||
          containsUntypedFunction(node.alternate)
        );
      }
      if (node.type === 'LogicalExpression') {
        return containsUntypedFunction(node.left) || containsUntypedFunction(node.right);
      }
      if (node.type === 'CallExpression') {
        return node.arguments.some(arg => containsUntypedFunction(arg));
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
        // For let declarations, TypeScript widens literal types (e.g. "" → string).
        // getTypeAtLocation returns the narrow literal type, so widen it to match
        // what TS would actually infer without the annotation.
        if (node.parent.kind === 'let') {
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
