import type {Project, ProjectVisibiliy} from 'sentry/types';

export default function projectToProjectVisibility({
  id,
  slug,
  isMember,
  environments,
  platform,
}: Project): ProjectVisibiliy {
  return {
    id,
    slug,
    isMember,
    environments,
    platform: platform || 'other', // can be `null` or `""`
  };
}
