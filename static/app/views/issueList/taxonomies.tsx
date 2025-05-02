import {t} from 'sentry/locale';
import {IssueCategory} from 'sentry/types/group';

export enum IssueTaxonomy {
  ERRORS_AND_OUTAGES = 'errors-outages',
  REGRESSIONS = 'regressions',
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
  [IssueTaxonomy.REGRESSIONS]: {
    categories: [IssueCategory.PERFORMANCE_REGRESSION],
    label: t('Regressions'),
    key: 'regressions',
  },
  [IssueTaxonomy.WARNINGS]: {
    categories: [
      IssueCategory.RESPONSIVENESS,
      IssueCategory.USER_EXPERIENCE,
      IssueCategory.PERFORMANCE_BEST_PRACTICE,
    ],
    label: t('Warnings'),
    key: 'warnings',
  },
};
