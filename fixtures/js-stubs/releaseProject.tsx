import type {ReleaseProject} from 'sentry/types/release';

export function ReleaseProjectFixture(
  params: Partial<ReleaseProject> = {}
): ReleaseProject {
  return {
    id: 2,
    name: 'Project Name',
    newGroups: 0,
    platform: 'android',
    platforms: ['android'],
    slug: 'project-slug',
    hasHealthData: false,
    ...params,
  };
}
