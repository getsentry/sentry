import {Fragment} from 'react';
import * as Sentry from '@sentry/react';

import {Stack} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {defined} from 'sentry/utils/defined';
import {decodeScalar} from 'sentry/utils/queryString';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useLocation} from 'sentry/utils/useLocation';
import {
  useMaxPickableDays,
  type MaxPickableDaysOptions,
} from 'sentry/utils/useMaxPickableDays';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ExploreBreadcrumb} from 'sentry/views/explore/components/breadcrumb';
import {
  MAX_DAYS_FOR_CROSS_EVENTS,
  MAX_PERIOD_FOR_CROSS_EVENTS,
} from 'sentry/views/explore/constants';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {ID_KEY, TITLE_KEY} from 'sentry/views/explore/queryParams/savedQuery';
import {
  SpanCardsQueryParamsProvider,
  useHasAnySpanCardCrossEvents,
} from 'sentry/views/explore/spans/spanCardsQueryParams';
import {SpanCardsTabContent} from 'sentry/views/explore/spans/spanCardsTab';
import {SpansTabOnboarding} from 'sentry/views/explore/spans/spansTab';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {TopBar} from 'sentry/views/navigation/topBar';

export function ExploreContent() {
  Sentry.setTag('explore.visited', 'yes');

  return (
    <SpanCardsQueryParamsProvider>
      <ExploreContentInner />
    </SpanCardsQueryParamsProvider>
  );
}

function ExploreContentInner() {
  const organization = useOrganization();
  const hasCrossEvents = useHasAnySpanCardCrossEvents();
  const onboardingProject = useOnboardingProject();
  const dataCategoryMaxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });

  const crossEventsDateOverride: MaxPickableDaysOptions = {
    defaultPeriod: MAX_PERIOD_FOR_CROSS_EVENTS,
    maxPickableDays: dataCategoryMaxPickableDays.maxPickableDays,
    maxUpgradableDays: MAX_DAYS_FOR_CROSS_EVENTS,
    maxDateRange: MAX_DAYS_FOR_CROSS_EVENTS,
  };

  const maxPickableDays = hasCrossEvents
    ? crossEventsDateOverride
    : dataCategoryMaxPickableDays;

  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);

  return (
    <SentryDocumentTitle title={t('Traces')} orgSlug={organization?.slug}>
      <PageFiltersContainer
        maxPickableDays={datePageFilterProps.maxPickableDays}
        maxDateRange={datePageFilterProps.maxDateRange}
      >
        <AnalyticsArea name="explore.spans">
          <Stack flex={1}>
            <SpansTabHeader />
            {defined(onboardingProject) ? (
              <SpansTabOnboarding
                organization={organization}
                project={onboardingProject}
                datePageFilterProps={datePageFilterProps}
              />
            ) : (
              <SpanCardsTabContent datePageFilterProps={datePageFilterProps} />
            )}
          </Stack>
        </AnalyticsArea>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

function SpansTabHeader() {
  const location = useLocation();
  const id = decodeScalar(location.query[ID_KEY]);
  const title = decodeScalar(location.query[TITLE_KEY]);
  const organization = useOrganization();
  const {data: savedQuery} = useGetSavedQuery(id);

  const hasSavedQueryTitle =
    defined(id) && defined(savedQuery) && savedQuery.name.length > 0;

  const documentTitle = hasSavedQueryTitle ? (
    <SentryDocumentTitle
      title={`${savedQuery.name} — ${t('Traces')}`}
      orgSlug={organization?.slug}
    />
  ) : null;

  const titleContent = (
    <PageHeadingQuestionTooltip
      docsUrl="https://docs.sentry.io/product/explore/trace-explorer/"
      title={t(
        'Find problematic spans/traces or compute real-time metrics via aggregation.'
      )}
      linkLabel={t('Read the Docs')}
    />
  );

  const hasBreadcrumb = Boolean(title && defined(id));

  return (
    <Fragment>
      {documentTitle}
      <TopBar.Slot name="title">
        {hasBreadcrumb ? (
          <ExploreBreadcrumb
            traceItemDataset={TraceItemDataset.SPANS}
            savedQueryName={savedQuery?.name}
          />
        ) : (
          title || t('Traces')
        )}
        {titleContent}
      </TopBar.Slot>
      <TopBar.Slot name="feedback">
        <FeedbackButton
          aria-label={t('Give Feedback')}
          tooltipProps={{title: t('Give Feedback')}}
        >
          {null}
        </FeedbackButton>
      </TopBar.Slot>
    </Fragment>
  );
}
