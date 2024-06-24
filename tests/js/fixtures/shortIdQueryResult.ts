import {GroupFixture} from 'sentry-fixture/group';

import type {ShortIdResponse} from 'sentry/types/group';

export function ShortIdQueryResultFixture(params = {}): ShortIdResponse {
  const group = GroupFixture({
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
