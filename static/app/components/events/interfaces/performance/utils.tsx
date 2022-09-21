import {t} from 'sentry/locale';
import {IssueType} from 'sentry/types';

import {ResourceLink} from './resources';

const RESOURCES_DESCRIPTIONS: Record<IssueType, string> = {
  [IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES]: t(
    "N+1 queries are extraneous queries (N) caused by a single, initial query (+1). In the Span Evidence above, we've identified the parent span where the extraneous spans are located, the source span where the queries are initialized, and the extraneous spans themselves. To learn more about how to fix N+1 problems, check out these resources:"
  ),
  [IssueType.ERROR]: '',
};

const RESOURCE_LINKS: Record<IssueType, ResourceLink[]> = {
  [IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES]: [
    {
      text: t('Finding and Fixing Django N+1 Problems'),
      link: 'https://blog.sentry.io/2020/09/14/finding-and-fixing-django-n-1-problems',
    },
    {
      text: t('Rails Guide: Active Record Query Interface'),
      link: 'https://guides.rubyonrails.org/active_record_querying.html#eager-loading-associations',
    },
    {
      text: t('Django select_related and prefetch_related'),
      link: 'https://betterprogramming.pub/django-select-related-and-prefetch-related-f23043fd635d',
    },
    // TODO: Update this when the blogpost has been written
    // {
    //   text: t('[Leave empty for future Sentry post]'),
    //   link: 'https://sentry.io/',
    // },
  ],
  [IssueType.ERROR]: [],
};

export function getResourceDescription(issueType: IssueType): string {
  return RESOURCES_DESCRIPTIONS[issueType];
}

export function getResourceLinks(issueType: IssueType) {
  return RESOURCE_LINKS[issueType];
}
