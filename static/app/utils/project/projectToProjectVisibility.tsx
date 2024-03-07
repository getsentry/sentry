import type {Project, ProjectVisibility} from 'sentry/types';

export default function projectToProjectVisibility({
  id,
  slug,
  isMember,
  environments,
  platform,
}: Project): ProjectVisibility {
  return {
    id,
    slug,
    isMember,
    environments,
    platform: platform || 'other', // can be `null` or `""`
  };
}
