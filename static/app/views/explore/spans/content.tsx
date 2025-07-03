import type {ReactNode} from 'react';
import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {TourContextProvider} from 'sentry/components/tours/components';
import {useAssistant} from 'sentry/components/tours/useAssistant';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
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
import {SpansTabContent, SpansTabOnboarding} from 'sentry/views/explore/spans/spansTab';
import {
  EXPLORE_SPANS_TOUR_GUIDE_KEY,
  type ExploreSpansTour,
  ExploreSpansTourContext,
  ORDERED_EXPLORE_SPANS_TOUR,
  useExploreSpansTourModal,
} from 'sentry/views/explore/spans/tour';
import {StarSavedQueryButton} from 'sentry/views/explore/starSavedQueryButton';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {limitMaxPickableDays} from 'sentry/views/explore/utils';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {usePrefersStackedNav} from 'sentry/views/nav/usePrefersStackedNav';

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
            <SpansTabHeader organization={organization} />
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
      <PageParamsProvider>
        <ExploreTagsProvider>{children}</ExploreTagsProvider>
      </PageParamsProvider>
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

interface SpansTabHeaderProps {
  organization: Organization;
}

function SpansTabHeader({organization}: SpansTabHeaderProps) {
  const prefersStackedNav = usePrefersStackedNav();
  const id = useExploreId();
  const title = useExploreTitle();
  const {data: savedQuery} = useGetSavedQuery(id);

  return (
    <Layout.Header unified={prefersStackedNav}>
      <Layout.HeaderContent unified={prefersStackedNav}>
        {title && defined(id) ? <ExploreBreadcrumb /> : null}
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
        <ButtonBar gap={1}>
          {!prefersStackedNav && (
            <LinkButton
              to={`/organizations/${organization.slug}/explore/saved-queries/`}
              size="sm"
            >
              {t('Saved Queries')}
            </LinkButton>
          )}
          <StarSavedQueryButton />
          {defined(id) && savedQuery?.isPrebuilt === false && <SavedQueryEditMenu />}
          <FeedbackWidgetButton />
        </ButtonBar>
      </Layout.HeaderActions>
    </Layout.Header>
  );
}
