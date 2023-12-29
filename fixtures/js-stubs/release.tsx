import {HealthFixture} from 'sentry-fixture/health';

import {Health, ReleaseStatus, ReleaseWithHealth} from 'sentry/types';

export function Release(
  params?: Partial<ReleaseWithHealth>,
  healthParams?: Health
): ReleaseWithHealth {
  return {
    newGroups: 0,
    commitCount: 0,
    url: '',
    data: {},
    lastDeploy: {
      dateFinished: '',
      dateStarted: '',
      environment: '',
      id: '',
      name: '',
      url: '',
      version: '',
    },
    deployCount: 0,
    shortVersion: '',
    fileCount: 0,
    status: ReleaseStatus.ACTIVE,
    dateCreated: '2020-03-23T01:02:30Z',
    dateReleased: '',
    id: '',
    lastEvent: '2020-03-24T02:04:50Z',
    version: 'sentry-android-shop@1.2.0',
    firstEvent: '',
    lastCommit: {
      dateCreated: '',
      id: '',
      message: null,
      releases: [],
    },
    authors: [],
    owner: null,
    versionInfo: {
      buildHash: null,
      version: {
        pre: null,
        raw: '1.2.0',
        major: 1,
        minor: 2,
        buildCode: null,
        patch: 0,
        components: 3,
      },
      description: '1.2.0',
      package: 'sentry-android-shop',
    },
    ref: '',
    projects: [
      {
        healthData: HealthFixture(),
        id: 4383603,
        name: 'Sentry-Android-Shop',
        slug: 'sentry-android-shop',
        platform: 'android',
        newGroups: 3,
        platforms: [],
        hasHealthData: true,
        ...healthParams,
      },
    ],
    currentProjectMeta: {
      nextReleaseVersion: '456',
      prevReleaseVersion: '123',
      firstReleaseVersion: '0',
      lastReleaseVersion: '999',
      sessionsUpperBound: null,
      sessionsLowerBound: null,
    },
    adoptionStages: {
      'sentry-android-shop': {
        adopted: '2020-03-24T01:02:30Z',
        stage: 'replaced',
        unadopted: '2020-03-24T02:02:30Z',
      },
    },
    ...params,
  };
}
