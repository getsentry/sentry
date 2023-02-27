interface OwnershipRulesParsed {
  // We've used a format similar to this in other places (assignment?, alert owners?)
  // Might need a way of handling unmatched codeowners since they won't have an id
  owners: string[];
  rule: string;
  type: string;
}

interface OwnershipRulesTableProps {}

export function OwnershipRulesTable() {
  const rules: OwnershipRulesParsed[] = [
    {
      owners: ['team:1303244'],
      rule: 'path:**/src/**',
      type: 'path',
    },
  ];
}
