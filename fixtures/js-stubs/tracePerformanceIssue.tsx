import {TracePerformanceIssue as PerformanceIssue} from 'sentry/utils/performance/quickTrace/types';

export function TracePerformanceIssue(
  params: Partial<PerformanceIssue> = {}
): PerformanceIssue {
  return {
    event_id: '09384ee83c9145e79b5f6fbed5c37a51',
    issue_id: 301,
    project_id: 8,
    project_slug: 'santry',
    title: 'Large HTTP payload',
    level: 'info',
    issue: '',
    type: 1015,
    ...params,
  };
}
