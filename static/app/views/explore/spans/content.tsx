import {Fragment, useMemo} from 'react';
import type {ReactNode} from 'react';
import * as Sentry from '@sentry/react';

import {Grid, Stack} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {TourContextProvider} from 'sentry/components/tours/components';
import {useAssistant} from 'sentry/components/tours/useAssistant';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
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
import {
  useQueryParamsCrossEvents,
  useQueryParamsId,
  useQueryParamsTitle,
} from 'sentry/views/explore/queryParams/context';
import {SavedQueryEditMenu} from 'sentry/views/explore/savedQueryEditMenu';
import {SpansCommandPaletteActions} from 'sentry/views/explore/spans/spansCommandPaletteActions';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';
import {SpansTabContent, SpansTabOnboarding} from 'sentry/views/explore/spans/spansTab';
import {
  EXPLORE_SPANS_TOUR_GUIDE_KEY,
  ExploreSpansTourContext,
  ORDERED_EXPLORE_SPANS_TOUR,
  useExploreSpansTourModal,
  type ExploreSpansTour,
} from 'sentry/views/explore/spans/tour';
import {StarSavedQueryButton} from 'sentry/views/explore/starSavedQueryButton';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

const CROSS_EVENTS_DATE_OVERRIDE: MaxPickableDaysOptions = {
  defaultPeriod: MAX_PERIOD_FOR_CROSS_EVENTS,
  maxPickableDays: MAX_DAYS_FOR_CROSS_EVENTS,
  maxUpgradableDays: MAX_DAYS_FOR_CROSS_EVENTS,
};

function useHasCrossEvents() {
  const crossEvents = useQueryParamsCrossEvents();
  return defined(crossEvents) && crossEvents.length > 0;
}

export function ExploreContent() {
  Sentry.setTag('explore.visited', 'yes');

  return (
    <SpansQueryParamsProvider>
      <ExploreContentInner />
    </SpansQueryParamsProvider>
  );
}

function ExploreContentInner() {
  const organization = useOrganization();
  const hasCrossEvents = useHasCrossEvents();
  const onboardingProject = useOnboardingProject();
  const dataCategoryMaxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });

  const maxPickableDays = hasCrossEvents
    ? CROSS_EVENTS_DATE_OVERRIDE
    : dataCategoryMaxPickableDays;

  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);

  return (
    <SentryDocumentTitle title={t('Traces')} orgSlug={organization?.slug}>
      <SpansCommandPaletteActions />
      <PageFiltersContainer maxPickableDays={datePageFilterProps.maxPickableDays}>
        <AnalyticsArea name="explore.spans">
          <Stack flex={1}>
            <SpansTabWrapper>
              <SpansTabHeader />
              {defined(onboardingProject) ? (
                <SpansTabOnboarding
                  organization={organization}
                  project={onboardingProject}
                  datePageFilterProps={datePageFilterProps}
                />
              ) : (
                <SpansTabContent datePageFilterProps={datePageFilterProps} />
              )}
            </SpansTabWrapper>
          </Stack>
        </AnalyticsArea>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

function SpansTabWrapper({children}: SpansTabContextProps) {
  return (
    <SpansTabTourProvider>
      <SpansTabTourTrigger />
      {children}
    </SpansTabTourProvider>
  );
}

interface SpansTabContextProps {
  children: ReactNode;
}

function SpansTabTourProvider({children}: SpansTabContextProps) {
  const {data: assistantData} = useAssistant();
  const isTourCompleted = useMemo(() => {
    const tourData = assistantData?.find(
      item => item.guide === EXPLORE_SPANS_TOUR_GUIDE_KEY
    );

    // Prevent tour from showing until assistant data is loaded
    return tourData?.seen ?? true;
  }, [assistantData]);

  return (
    <TourContextProvider<ExploreSpansTour>
      tourKey={EXPLORE_SPANS_TOUR_GUIDE_KEY}
      isCompleted={isTourCompleted}
      orderedStepIds={ORDERED_EXPLORE_SPANS_TOUR}
      TourContext={ExploreSpansTourContext}
    >
      {children}
    </TourContextProvider>
  );
}

function SpansTabTourTrigger() {
  useExploreSpansTourModal();
  return null;
}

function SpansTabHeader() {
  const id = useQueryParamsId();
  const title = useQueryParamsTitle();
  const organization = useOrganization();
  const {data: savedQuery} = useGetSavedQuery(id);
  const hasPageFrameFeature = useHasPageFrameFeature();

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

  if (hasPageFrameFeature) {
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
        <TopBar.Slot name="actions">
          <StarSavedQueryButton />
          {defined(id) && savedQuery?.isPrebuilt === false && <SavedQueryEditMenu />}
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

  return (
    <Layout.Header unified>
      {documentTitle}
      <Layout.HeaderContent unified>
        <Fragment>
          {hasBreadcrumb ? (
            <ExploreBreadcrumb
              traceItemDataset={TraceItemDataset.SPANS}
              savedQueryName={savedQuery?.name}
            />
          ) : null}
          <Layout.Title>
            {title || t('Traces')}
            {titleContent}
          </Layout.Title>
        </Fragment>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <Grid flow="column" align="center" gap="md">
          <StarSavedQueryButton />
          {defined(id) && savedQuery?.isPrebuilt === false && <SavedQueryEditMenu />}
          <FeedbackButton />
        </Grid>
      </Layout.HeaderActions>
    </Layout.Header>
  );
}
