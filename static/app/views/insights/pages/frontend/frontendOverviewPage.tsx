import {type DatePageFilterProps} from 'sentry/components/pageFilters/date/datePageFilter';
import {DataCategory} from 'sentry/types/core';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import {DomainOverviewPageProviders} from 'sentry/views/insights/pages/domainOverviewPageProviders';
import {Am1FrontendOverviewPage} from 'sentry/views/insights/pages/frontend/am1OverviewPage';
import {PlatformizedFrontendOverviewPage} from 'sentry/views/insights/pages/frontend/platformizedFrontendOverviewPage';
import {NextJsOverviewPage} from 'sentry/views/insights/pages/platform/nextjs';
import {useIsNextJsInsightsAvailable} from 'sentry/views/insights/pages/platform/nextjs/features';
import {PlatformizedNextJsOverviewPage} from 'sentry/views/insights/pages/platform/nextjs/platformizedNextJsOverviewPage';
import {useOverviewPageTrackPageload} from 'sentry/views/insights/pages/useOverviewPageTrackAnalytics';

interface FrontendOverviewPageProps {
  datePageFilterProps: DatePageFilterProps;
}

function FrontendOverviewPage({datePageFilterProps}: FrontendOverviewPageProps) {
  useOverviewPageTrackPageload();
  const isNextJsPageEnabled = useIsNextJsInsightsAvailable();
  const isEapEligible = useInsightsEap();

  if (isNextJsPageEnabled) {
    return isEapEligible ? (
      <PlatformizedNextJsOverviewPage />
    ) : (
      <NextJsOverviewPage datePageFilterProps={datePageFilterProps} />
    );
  }

  if (isEapEligible) {
    return <PlatformizedFrontendOverviewPage />;
  }
  return <Am1FrontendOverviewPage datePageFilterProps={datePageFilterProps} />;
}

function FrontendOverviewPageWithProviders() {
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });
  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);

  return (
    <DomainOverviewPageProviders maxPickableDays={maxPickableDays.maxPickableDays}>
      <FrontendOverviewPage datePageFilterProps={datePageFilterProps} />
    </DomainOverviewPageProviders>
  );
}

export default FrontendOverviewPageWithProviders;
