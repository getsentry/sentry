import {DataCategory} from 'sentry/types/core';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {DomainOverviewPageProviders} from 'sentry/views/insights/pages/domainOverviewPageProviders';
import {PlatformizedFrontendOverviewPage} from 'sentry/views/insights/pages/frontend/platformizedFrontendOverviewPage';
import {useIsNextJsInsightsAvailable} from 'sentry/views/insights/pages/platform/nextjs/features';
import {PlatformizedNextJsOverviewPage} from 'sentry/views/insights/pages/platform/nextjs/platformizedNextJsOverviewPage';
import {useOverviewPageTrackPageload} from 'sentry/views/insights/pages/useOverviewPageTrackAnalytics';

function FrontendOverviewPage() {
  useOverviewPageTrackPageload();
  const isNextJsPageEnabled = useIsNextJsInsightsAvailable();

  if (isNextJsPageEnabled) {
    return <PlatformizedNextJsOverviewPage />;
  }

  return <PlatformizedFrontendOverviewPage />;
}

function FrontendOverviewPageWithProviders() {
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });

  return (
    <DomainOverviewPageProviders maxPickableDays={maxPickableDays.maxPickableDays}>
      <FrontendOverviewPage />
    </DomainOverviewPageProviders>
  );
}

export default FrontendOverviewPageWithProviders;
