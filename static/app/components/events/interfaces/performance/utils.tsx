import {t} from 'sentry/locale';
import {IssueType, PlatformType} from 'sentry/types';

import {PYTHON_RESOURCE_LINKS} from './constants';
import {ResourceLink} from './resources';

const RESOURCES_DESCRIPTIONS: Record<IssueType, string> = {
  [IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES]: t(
    "N+1 queries are extraneous queries (N) caused by a single, initial query (+1). In the Span Evidence above, we've identified the parent span where the extraneous spans are located and the extraneous spans themselves. To learn more about how to fix N+1 problems, check out these resources:"
  ),
  [IssueType.ERROR]: '',
};

type PlatformSpecificResources = Partial<Record<PlatformType, ResourceLink[]>>;

const RESOURCE_LINKS: Record<IssueType, PlatformSpecificResources> = {
  [IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES]: {
    python: PYTHON_RESOURCE_LINKS,
    'python-django': PYTHON_RESOURCE_LINKS,
    'python-flask': PYTHON_RESOURCE_LINKS,
    'python-fastapi': PYTHON_RESOURCE_LINKS,
    'python-starlette': PYTHON_RESOURCE_LINKS,
    'python-sanic': PYTHON_RESOURCE_LINKS,
    'python-celery': PYTHON_RESOURCE_LINKS,
    'python-bottle': PYTHON_RESOURCE_LINKS,
    'python-pylons': PYTHON_RESOURCE_LINKS,
    'python-pyramid': PYTHON_RESOURCE_LINKS,
    'python-tornado': PYTHON_RESOURCE_LINKS,
    'python-rq': PYTHON_RESOURCE_LINKS,
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
  if (!platform || !(platform in RESOURCE_LINKS[issueType])) {
    return [];
  }

  return RESOURCE_LINKS[issueType][platform] as ResourceLink[];
}
