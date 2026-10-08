import {IssueType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';

export const ISSUE_TYPES_OPENED_PER_OPEN_PERIOD: ReadonlySet<IssueType> = new Set([
  IssueType.METRIC_ISSUE,
]);

export function detectorsOpenIssuePerOpenPeriod(organization: Organization): boolean {
  return organization.features.includes('workflow-engine-rotate-activation-id');
}
