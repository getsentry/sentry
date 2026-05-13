import {ProjectFixture as SentryProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import type {Project as TProject} from 'sentry/types/project';

export function ProjectFixture(params: Partial<TProject>): TProject {
  const rodentOpsTeam = TeamFixture({
    id: '187649',
    name: 'Rodent Ops',
    slug: 'rodent-ops',
  });
  return SentryProjectFixture({
    access: ['project:releases', 'project:read'],
    dateCreated: '2018-01-01T18:19:31.693Z',
    firstEvent: '2018-01-01T18:49:24Z',
    hasAccess: true,
    id: '1213086',
    isBookmarked: false,
    isMember: false,
    latestDeploys: null,
    name: 'squirrel-finder-backend',
    platform: 'python-flask',
    slug: 'squirrel-finder-backend',
    team: rodentOpsTeam,
    teams: [rodentOpsTeam],
    ...params,
  });
}
