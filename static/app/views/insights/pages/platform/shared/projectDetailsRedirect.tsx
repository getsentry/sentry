import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {
  hasLaravelInsightsFeature,
  useIsLaravelInsightsAvailable,
} from 'sentry/views/insights/pages/platform/laravel/features';
import {
  hasNextJsInsightsFeature,
  useIsNextJsInsightsAvailable,
} from 'sentry/views/insights/pages/platform/nextjs/features';

export function getProjectDetailsRedirect(
  organization: Organization,
  project: Project
): string | null {
  let target: 'frontend' | 'backend' | null = null;
  if (hasLaravelInsightsFeature(organization) && project.platform === 'php-laravel') {
    target = 'backend';
  }
  if (
    hasNextJsInsightsFeature(organization) &&
    project.platform === 'javascript-nextjs'
  ) {
    target = 'frontend';
  }

  if (target) {
    return `/insights/${target}/?project=${project.id}${project.isBookmarked ? '&starred=1' : ''}`;
  }
  return null;
}

export function useIsProjectDetailsRedirectActive() {
  const location = useLocation();
  const isLaravelActive = useIsLaravelInsightsAvailable();
  const isNextJsActive = useIsNextJsInsightsAvailable();

  const isSingleProjectSelected =
    typeof location.query.project === 'string' && location.query.project !== '-1';

  const isStarredProjectSelected = location.query.starred === '1';

  return (
    isStarredProjectSelected &&
    isSingleProjectSelected &&
    (isLaravelActive || isNextJsActive)
  );
}
