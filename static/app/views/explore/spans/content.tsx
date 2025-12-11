import type {ReactNode} from 'react';
import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {TourContextProvider} from 'sentry/components/tours/components';
import {useAssistant} from 'sentry/components/tours/useAssistant';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import useOrganization from 'sentry/utils/useOrganization';
import ExploreBreadcrumb from 'sentry/views/explore/components/breadcrumb';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {
  useQueryParamsId,
  useQueryParamsTitle,
} from 'sentry/views/explore/queryParams/context';
import {SavedQueryEditMenu} from 'sentry/views/explore/savedQueryEditMenu';
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

export function ExploreContent() {
  Sentry.setTag('explore.visited', 'yes');

  const organization = useOrganization();
  const onboardingProject = useOnboardingProject();
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });
  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);

  return (
    <SentryDocumentTitle title={t('Traces')} orgSlug={organization?.slug}>
      <PageFiltersContainer maxPickableDays={datePageFilterProps.maxPickableDays}>
        <Layout.Page>
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
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

function SpansTabWrapper({children}: SpansTabContextProps) {
  return (
    <SpansTabTourProvider>
      <SpansTabTourTrigger />
      <SpansQueryParamsProvider>
        <ExploreTagsProvider>{children}</ExploreTagsProvider>
      </SpansQueryParamsProvider>
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

function ExploreTagsProvider({children}: SpansTabContextProps) {
  return (
    <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
      {children}
    </TraceItemAttributeProvider>
  );
}

function SpansTabHeader() {
  const id = useQueryParamsId();
  const title = useQueryParamsTitle();
  const organization = useOrganization();
  const {data: savedQuery} = useGetSavedQuery(id);

  const hasSavedQueryTitle =
    defined(id) && defined(savedQuery) && savedQuery.name.length > 0;

  return (
    <Layout.Header unified>
      <Layout.HeaderContent unified>
        {hasSavedQueryTitle ? (
          <SentryDocumentTitle
            title={`${savedQuery.name} — ${t('Traces')}`}
            orgSlug={organization?.slug}
          />
        ) : null}
        {title && defined(id) ? (
          <ExploreBreadcrumb traceItemDataset={TraceItemDataset.SPANS} />
        ) : null}
        <Layout.Title>
          {title ? title : t('Traces')}
          <PageHeadingQuestionTooltip
            docsUrl="https://github.com/getsentry/sentry/discussions/81239"
            title={t(
              'Find problematic spans/traces or compute real-time metrics via aggregation.'
            )}
            linkLabel={t('Read the Discussion')}
          />
        </Layout.Title>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <ButtonBar>
          <StarSavedQueryButton />
          {defined(id) && savedQuery?.isPrebuilt === false && <SavedQueryEditMenu />}
          <FeedbackButton />
        </ButtonBar>
      </Layout.HeaderActions>
    </Layout.Header>
  );
}
