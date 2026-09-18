import {DataCategory} from 'sentry/types/core';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {PlatformizedBackendOverviewPage} from 'sentry/views/insights/pages/backend/platformizedBackendOverviewPage';
import {DomainOverviewPageProviders} from 'sentry/views/insights/pages/domainOverviewPageProviders';
import {useIsLaravelInsightsAvailable} from 'sentry/views/insights/pages/platform/laravel/features';
import {PlatformizedLaravelOverviewPage} from 'sentry/views/insights/pages/platform/laravel/platformizedLaravelOverviewPage';
import {useIsNextJsInsightsAvailable} from 'sentry/views/insights/pages/platform/nextjs/features';
import {PlatformizedNextJsOverviewPage} from 'sentry/views/insights/pages/platform/nextjs/platformizedNextJsOverviewPage';
import {useOverviewPageTrackPageload} from 'sentry/views/insights/pages/useOverviewPageTrackAnalytics';

function BackendOverviewPage() {
  useOverviewPageTrackPageload();
  const isLaravelPageAvailable = useIsLaravelInsightsAvailable();
  const isNextJsPageEnabled = useIsNextJsInsightsAvailable();

  if (isLaravelPageAvailable) {
    return <PlatformizedLaravelOverviewPage />;
  }

  if (isNextJsPageEnabled) {
    return <PlatformizedNextJsOverviewPage />;
  }

  return <PlatformizedBackendOverviewPage />;
}

function BackendOverviewPageWithProviders() {
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });

  return (
    <DomainOverviewPageProviders maxPickableDays={maxPickableDays.maxPickableDays}>
      <BackendOverviewPage />
    </DomainOverviewPageProviders>
  );
}

export default BackendOverviewPageWithProviders;
