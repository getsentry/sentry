import {ProjectFixture} from 'sentry-fixture/project';

import type {ReleaseMeta} from 'sentry/types/release';

export function ReleaseMetaFixture(params: Partial<ReleaseMeta> = {}): ReleaseMeta {
  const project = ProjectFixture();
  return {
    version: 'sentry-android-shop@1.2.0',
    versionInfo: {
      package: 'sentry-android-shop',
      version: {
        raw: '1.2.0',
        major: 1,
        minor: 2,
        patch: 0,
        pre: null,
        buildCode: null,
        components: 3,
      },
      description: '1.2.0',
      buildHash: null,
    },
    projects: [
      {
        id: Number(project.id),
        slug: project.slug,
        name: project.name,
        newGroups: 0,
        platform: project.platform ?? 'android',
        platforms: ['javascript'],
      },
    ],
    newGroups: 0,
    deployCount: 1,
    commitCount: 2,
    released: '2020-03-23T01:02:30Z',
    commitFilesChanged: 17,
    releaseFileCount: 1662,
    isArtifactBundle: false,
    ...params,
  };
}
