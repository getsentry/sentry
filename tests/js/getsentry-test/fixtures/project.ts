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
    stats: [
      [1514764800.0, 0],
      [1514851200.0, 0],
      [1514937600.0, 0],
      [1515024000.0, 0],
      [1515110400.0, 0],
      [1515196800.0, 0],
      [1515283200.0, 0],
      [1515369600.0, 0],
      [1515456000.0, 0],
      [1515542400.0, 0],
      [1515628800.0, 0],
      [1515715200.0, 0],
      [1515801600.0, 0],
      [1515888000.0, 0],
      [1515974400.0, 0],
      [1516060800.0, 0],
      [1516147200.0, 0],
      [1516233600.0, 0],
      [1516320000.0, 0],
      [1516406400.0, 0],
      [1516492800.0, 0],
      [1516579200.0, 0],
      [1516665600.0, 0],
      [1516752000.0, 0],
      [1516838400.0, 0],
      [1516924800.0, 0],
      [1517011200.0, 0],
      [1517097600.0, 0],
      [1517184000.0, 0],
      [1517270400.0, 0],
    ],
    team: rodentOpsTeam,
    teams: [rodentOpsTeam],
    ...params,
  });
}
