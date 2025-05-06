import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  hasLaravelInsightsFeature,
  useIsLaravelInsightsAvailable,
} from 'sentry/views/insights/pages/platform/laravel/features';
import {useIsNextJsInsightsEnabled} from 'sentry/views/insights/pages/platform/nextjs/features';

export function useProjectDetailsRedirect(project?: Project): string | null {
  const organization = useOrganization();
  const location = useLocation();
  const [isNextJsInsightsEnabled] = useIsNextJsInsightsEnabled();
  if (!project) {
    return null;
  }
  let target: 'frontend' | 'backend' | null = null;
  if (hasLaravelInsightsFeature(organization) && project.platform === 'php-laravel') {
    target = 'backend';
  }
  if (isNextJsInsightsEnabled && project.platform === 'javascript-nextjs') {
    target = 'frontend';
  }

  if (target) {
    return `/insights/${target}/?project=${project.id}${project.isBookmarked || location.query.source === 'sidebar' ? '&starred=1' : ''}`;
  }
  return null;
}

export function useIsProjectDetailsRedirectActive() {
  const location = useLocation();
  const isLaravelActive = useIsLaravelInsightsAvailable();
  const [isNextJsInsightsEnabled] = useIsNextJsInsightsEnabled();

  const isSingleProjectSelected =
    typeof location.query.project === 'string' && location.query.project !== '-1';

  const isStarredProjectSelected = location.query.starred === '1';

  return (
    isStarredProjectSelected &&
    isSingleProjectSelected &&
    (isLaravelActive || isNextJsInsightsEnabled)
  );
}
