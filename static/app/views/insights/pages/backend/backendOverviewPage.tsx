import {type DatePageFilterProps} from 'sentry/components/pageFilters/date/datePageFilter';
import {DataCategory} from 'sentry/types/core';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import {Am1BackendOverviewPage} from 'sentry/views/insights/pages/backend/am1BackendOverviewPage';
import {PlatformizedBackendOverviewPage} from 'sentry/views/insights/pages/backend/platformizedBackendOverviewPage';
import {DomainOverviewPageProviders} from 'sentry/views/insights/pages/domainOverviewPageProviders';
import {useIsLaravelInsightsAvailable} from 'sentry/views/insights/pages/platform/laravel/features';
import {PlatformizedLaravelOverviewPage} from 'sentry/views/insights/pages/platform/laravel/platformizedLaravelOverviewPage';
import {useIsNextJsInsightsAvailable} from 'sentry/views/insights/pages/platform/nextjs/features';
import {PlatformizedNextJsOverviewPage} from 'sentry/views/insights/pages/platform/nextjs/platformizedNextJsOverviewPage';
import {useOverviewPageTrackPageload} from 'sentry/views/insights/pages/useOverviewPageTrackAnalytics';

interface BackendOverviewPageProps {
  datePageFilterProps: DatePageFilterProps;
}

function BackendOverviewPage({datePageFilterProps}: BackendOverviewPageProps) {
  useOverviewPageTrackPageload();
  const isLaravelPageAvailable = useIsLaravelInsightsAvailable();
  const isNextJsPageEnabled = useIsNextJsInsightsAvailable();
  const isEapEligible = useInsightsEap();

  // useIsLaravelInsightsAvailable and useIsNextJsInsightsAvailable already
  // require EAP internally, so when they return true we can go straight to
  // the platformized variant.
  if (isLaravelPageAvailable) {
    return <PlatformizedLaravelOverviewPage />;
  }

  if (isNextJsPageEnabled) {
    return <PlatformizedNextJsOverviewPage />;
  }

  if (isEapEligible) {
    return <PlatformizedBackendOverviewPage />;
  }
  return <Am1BackendOverviewPage datePageFilterProps={datePageFilterProps} />;
}

function BackendOverviewPageWithProviders() {
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });
  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);

  return (
    <DomainOverviewPageProviders maxPickableDays={maxPickableDays.maxPickableDays}>
      <BackendOverviewPage datePageFilterProps={datePageFilterProps} />
    </DomainOverviewPageProviders>
  );
}

export default BackendOverviewPageWithProviders;
