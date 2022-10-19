import {t} from 'sentry/locale';
import {IssueType, PlatformType} from 'sentry/types';

import {ResourceLink} from './resources';

const ALL_INCLUSIVE_RESOURCE_LINKS: ResourceLink[] = [
  {
    text: t('Sentry Docs: N+1 Queries'),
    link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/n-one-queries/',
  },
];

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
    ],
    'python-django': [
      {
        text: t('Finding and Fixing Django N+1 Problems'),
        link: 'https://blog.sentry.io/2020/09/14/finding-and-fixing-django-n-1-problems',
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
  if (!platform || !RESOURCE_LINKS[issueType] || !RESOURCE_LINKS[issueType][platform]) {
    return ALL_INCLUSIVE_RESOURCE_LINKS;
  }

  return [...ALL_INCLUSIVE_RESOURCE_LINKS, ...RESOURCE_LINKS[issueType][platform]!];
}
