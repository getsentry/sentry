import type {ReactNode} from 'react';
import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {TourContextProvider} from 'sentry/components/tours/components';
import {useAssistant} from 'sentry/components/tours/useAssistant';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';
import ExploreBreadcrumb from 'sentry/views/explore/components/breadcrumb';
import {
  PageParamsProvider,
  useExploreId,
  useExploreTitle,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
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
import {limitMaxPickableDays} from 'sentry/views/explore/utils';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';

export function ExploreContent() {
  Sentry.setTag('explore.visited', 'yes');

  const organization = useOrganization();
  const datePageFilterProps = limitMaxPickableDays(organization);

  const onboardingProject = useOnboardingProject();

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
        <PageParamsProvider>
          <ExploreTagsProvider>{children}</ExploreTagsProvider>
        </PageParamsProvider>
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
  const id = useExploreId();
  const title = useExploreTitle();
  const {data: savedQuery} = useGetSavedQuery(id);

  return (
    <Layout.Header unified>
      <Layout.HeaderContent unified>
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
          <FeedbackWidgetButton />
        </ButtonBar>
      </Layout.HeaderActions>
    </Layout.Header>
  );
}
