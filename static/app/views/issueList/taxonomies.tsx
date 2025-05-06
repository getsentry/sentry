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
    key: string;
    label: string;
  }
> = {
  [IssueTaxonomy.ERRORS_AND_OUTAGES]: {
    categories: [IssueCategory.ERROR, IssueCategory.OUTAGE],
    label: t('Errors & Outages'),
    key: 'errors-outages',
  },
  [IssueTaxonomy.BREACHED_METRICS]: {
    categories: [IssueCategory.METRIC],
    label: t('Breached Metrics'),
    key: 'breached-metrics',
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
  },
};
