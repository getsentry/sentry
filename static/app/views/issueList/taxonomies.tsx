import type {ReactNode} from 'react';

import {t} from 'sentry/locale';
import {IssueCategory} from 'sentry/types/group';

export enum IssueTaxonomy {
  ERRORS_AND_OUTAGES = 'errors-outages',
  BREACHED_METRICS = 'breached-metrics',
  WARNINGS = 'warnings',
}

export const ISSUE_TAXONOMY_CONFIG: Record<
  IssueTaxonomy,
  {
    categories: IssueCategory[];
    description: ReactNode;
    key: string;
    label: string;
  }
> = {
  [IssueTaxonomy.ERRORS_AND_OUTAGES]: {
    categories: [IssueCategory.ERROR, IssueCategory.OUTAGE],
    label: t('Errors & Outages'),
    key: 'errors-outages',
    description: t(
      'Issues that break functionality such as application errors, failed jobs, or downtime incidents.'
    ),
  },
  [IssueTaxonomy.BREACHED_METRICS]: {
    categories: [IssueCategory.METRIC],
    label: t('Breached Metrics'),
    key: 'breached-metrics',
    description: t(
      'Issues that indicate degraded system behavior such as endpoint latency regressions or metric threshold violations'
    ),
  },
  [IssueTaxonomy.WARNINGS]: {
    categories: [
      IssueCategory.DB_QUERY,
      IssueCategory.HTTP_CLIENT,
      IssueCategory.FRONTEND,
      IssueCategory.MOBILE,
    ],
    label: t('Warnings'),
    key: 'warnings',
    description: t(
      'Issues in your code or configuration that may not break functionality but can degrade performance or user experience'
    ),
  },
};
