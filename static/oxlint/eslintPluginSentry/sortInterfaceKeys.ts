import {AST_NODE_TYPES, ESLintUtils, type TSESTree} from '@typescript-eslint/utils';

type Options = {
  caseSensitive?: boolean;
  natural?: boolean;
  requiredFirst?: boolean;
};

type SortableMember = TSESTree.TypeElement;

function getName(member: SortableMember): string | undefined {
  if (member.type === AST_NODE_TYPES.TSIndexSignature) {
    const parameter = member.parameters[0];
    return parameter?.type === AST_NODE_TYPES.Identifier
      ? `[index: ${parameter.name}]`
      : '[index]';
  }
  if (
    member.type !== AST_NODE_TYPES.TSMethodSignature &&
    member.type !== AST_NODE_TYPES.TSPropertySignature
  ) {
    return undefined;
  }
  if (member.key.type === AST_NODE_TYPES.Identifier && !member.computed) {
    return member.key.name;
  }
  if (member.key.type === AST_NODE_TYPES.Literal) {
    return String(member.key.value);
  }
  return undefined;
}

function isOptional(member: SortableMember): boolean {
  return (
    (member.type === AST_NODE_TYPES.TSMethodSignature ||
      member.type === AST_NODE_TYPES.TSPropertySignature) &&
    member.optional
  );
}

export const sortInterfaceKeys = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {description: 'Require interface and type-literal keys to be sorted'},
    fixable: 'code',
    schema: [
      {type: 'string', enum: ['asc', 'desc']},
      {
        type: 'object',
        properties: {
          caseSensitive: {type: 'boolean'},
          natural: {type: 'boolean'},
          requiredFirst: {type: 'boolean'},
        },
        additionalProperties: false,
      },
    ],
    messages: {
      invalidOrder:
        "Expected interface keys to be in {{description}} order. '{{thisName}}' should be before '{{previousName}}'.",
    },
  },
  create(context) {
    const direction = context.options[0] === 'desc' ? 'desc' : 'asc';
    const options = (context.options[1] ?? {}) as Options;

    function compareNames(left: string, right: string): number {
      const normalizedLeft = options.caseSensitive === false ? left.toLowerCase() : left;
      const normalizedRight =
        options.caseSensitive === false ? right.toLowerCase() : right;
      if (options.natural) {
        return normalizedLeft.localeCompare(normalizedRight, 'en', {numeric: true});
      }
      return normalizedLeft < normalizedRight
        ? -1
        : normalizedLeft > normalizedRight
          ? 1
          : 0;
    }

    function compare(left: SortableMember, right: SortableMember): number {
      if (options.requiredFirst && isOptional(left) !== isOptional(right)) {
        return isOptional(left) ? 1 : -1;
      }

      const leftName = getName(left);
      const rightName = getName(right);
      if (leftName === undefined || rightName === undefined) {
        return 0;
      }
      const [firstName, secondName] =
        direction === 'asc' ? [leftName, rightName] : [rightName, leftName];
      const firstWeight = firstName.startsWith('[index:') ? 100 : 0;
      const secondWeight = secondName.startsWith('[index:') ? 100 : 0;
      return compareNames(firstName, secondName) - firstWeight + secondWeight;
    }

    function checkMembers(
      members: SortableMember[],
      container: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral
    ): void {
      const sorted = members.toSorted(compare);
      const violations = members
        .slice(1)
        .flatMap((member, index) =>
          compare(members[index]!, member) > 0 ? [[members[index]!, member] as const] : []
        );
      if (!violations.length) {
        return;
      }

      const sourceCode = context.sourceCode;
      const comments = sourceCode.getCommentsInside(container);
      const separators = members
        .slice(1)
        .map((member, index) =>
          sourceCode.text.slice(members[index]!.range[1], member.range[0])
        );
      const canFix =
        comments.length === 0 &&
        separators.every(separator => separator === separators[0]);

      for (const [index, [previous, member]] of violations.entries()) {
        context.report({
          node: member,
          messageId: 'invalidOrder',
          data: {
            description: [
              options.requiredFirst ? 'required-first' : '',
              options.natural ? 'natural' : '',
              options.caseSensitive === false ? 'case-insensitive' : '',
              direction === 'asc' ? 'ascending' : 'descending',
            ]
              .filter(Boolean)
              .join(' '),
            previousName: getName(previous) ?? '',
            thisName: getName(member) ?? '',
          },
          fix:
            index === 0 && canFix
              ? fixer => {
                  const separator = separators[0] ?? ' ';
                  const replacement = sorted
                    .map((sortedMember, sortedIndex) => {
                      const text = sourceCode.getText(sortedMember);
                      return sortedIndex < sorted.length - 1 && !/[;,]$/u.test(text)
                        ? `${text};`
                        : text;
                    })
                    .join(separator);
                  return fixer.replaceTextRange(
                    [members[0]!.range[0], members.at(-1)!.range[1]],
                    replacement
                  );
                }
              : undefined,
        });
      }
    }

    return {
      TSInterfaceDeclaration(node) {
        checkMembers(node.body.body, node.body);
      },
      TSTypeLiteral(node) {
        checkMembers(node.members, node);
      },
    };
  },
});
