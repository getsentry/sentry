import type {ProjectOption} from 'sentry/types';

export function ProjectOptionFixture(params: Partial<ProjectOption> = {}): ProjectOption {
  return {
    environments: [],
    id: '2',
    isMember: true,
    platform: 'other',
    slug: 'project-slug',
    ...params,
  };
}
