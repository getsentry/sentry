/**
 * Mirrors OwnershipRuleOwnerResponse from the backend
 */
interface OwnershipRuleOwner {
  name: string;
  type: 'user' | 'team';
  id?: string;
}

export interface ParsedOwnershipRule {
  matcher: {pattern: string; type: string};
  owners: OwnershipRuleOwner[];
}
