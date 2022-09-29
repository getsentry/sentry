import {t} from 'sentry/locale';
import {IssueType, PlatformType} from 'sentry/types';

import {ResourceLink} from './resources';

const RESOURCES_DESCRIPTIONS: Record<IssueType, string> = {
  [IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES]: t(
    "N+1 queries are extraneous queries (N) caused by a single, initial query (+1). In the Span Evidence above, we've identified the parent span where the extraneous spans are located and the extraneous spans themselves. To learn more about how to fix N+1 problems, check out these resources:"
  ),
  [IssueType.ERROR]: '',
};

type PlatformSpecificResources = Partial<Record<PlatformType, ResourceLink[]>>;

// TODO: When the Sentry blogpost for N+1s and documentation has been released, add them as resources for all platforms
const RESOURCE_LINKS: Record<IssueType, PlatformSpecificResources> = {
  [IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES]: {
    python: [
      {
        text: t('Finding and Fixing Django N+1 Problems'),
        link: 'https://blog.sentry.io/2020/09/14/finding-and-fixing-django-n-1-problems',
      },
      {
        text: t('Django select_related and prefetch_related'),
        link: 'https://betterprogramming.pub/django-select-related-and-prefetch-related-f23043fd635d',
      },
    ],
    'python-django': [
      {
        text: t('Finding and Fixing Django N+1 Problems'),
        link: 'https://blog.sentry.io/2020/09/14/finding-and-fixing-django-n-1-problems',
      },
      {
        text: t('Django select_related and prefetch_related'),
        link: 'https://betterprogramming.pub/django-select-related-and-prefetch-related-f23043fd635d',
      },
    ],
    'ruby-rails': [
      {
        text: t('Rails Guide: Active Record Query Interface'),
        link: 'https://guides.rubyonrails.org/active_record_querying.html#eager-loading-associations',
      },
    ],
  },
  [IssueType.ERROR]: {},
};

export function getResourceDescription(issueType: IssueType): string {
  return RESOURCES_DESCRIPTIONS[issueType];
}

export function getResourceLinks(
  issueType: IssueType,
  platform: PlatformType | undefined
): ResourceLink[] {
  if (!platform || !RESOURCE_LINKS[issueType][platform]) {
    return [];
  }

  return RESOURCE_LINKS[issueType][platform] ?? [];
}
