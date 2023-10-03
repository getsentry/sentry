import {Group} from 'sentry-fixture/group';

import {ShortIdResponse} from 'sentry/types';

export function ShortIdQueryResult(params = {}): ShortIdResponse {
  const group = Group({
    metadata: {
      type: 'group type',
      value: 'group description',
    },
  });
  return {
    organizationSlug: 'org-slug',
    projectSlug: 'project-slug',
    groupId: group.id,
    shortId: 'test-1',
    group,
    ...params,
  };
}
