import {Fragment} from 'react';
import styled from '@emotion/styled';

import AnalyticsArea from 'sentry/components/analyticsArea';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackFilters from 'sentry/components/feedback/feedbackFilters';
import FeedbackItemLoader from 'sentry/components/feedback/feedbackItem/feedbackItemLoader';
import FeedbackSearch from 'sentry/components/feedback/feedbackSearch';
import FeedbackSetupPanel from 'sentry/components/feedback/feedbackSetupPanel';
import FeedbackList from 'sentry/components/feedback/list/feedbackList';
import FeedbackSummaryCategories from 'sentry/components/feedback/summaryCategories/feedbackSummaryCategories';
import useCurrentFeedbackId from 'sentry/components/feedback/useCurrentFeedbackId';
import useHaveSelectedProjectsSetupFeedback from 'sentry/components/feedback/useFeedbackOnboarding';
import {FeedbackQueryKeys} from 'sentry/components/feedback/useFeedbackQueryKeys';
import useRedirectToFeedbackFromEvent from 'sentry/components/feedback/useRedirectToFeedbackFromEvent';
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {usePrefersStackedNav} from 'sentry/views/nav/usePrefersStackedNav';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

export default function FeedbackListPage() {
  const organization = useOrganization();
  const {hasSetupOneFeedback} = useHaveSelectedProjectsSetupFeedback();

  useRedirectToFeedbackFromEvent();

  const feedbackId = useCurrentFeedbackId();
  const hasSlug = Boolean(feedbackId);

  const prefersStackedNav = usePrefersStackedNav();

  return (
    <SentryDocumentTitle title={t('User Feedback')} orgSlug={organization.slug}>
      <FullViewport>
        <FeedbackQueryKeys organization={organization}>
          <Layout.Header unified={prefersStackedNav}>
            <Layout.HeaderContent unified={prefersStackedNav}>
              <Layout.Title>
                {t('User Feedback')}
                <PageHeadingQuestionTooltip
                  title={t(
                    'The User Feedback Widget allows users to submit feedback quickly and easily any time they encounter something that isn’t working as expected.'
                  )}
                  docsUrl="https://docs.sentry.io/product/user-feedback/"
                />
              </Layout.Title>
            </Layout.HeaderContent>
          </Layout.Header>
          <PageFiltersContainer>
            <ErrorBoundary>
              <Background>
                <LayoutGrid>
                  <FiltersContainer style={{gridArea: 'top'}}>
                    <FeedbackFilters />
                    <SearchContainer>
                      <FeedbackSearch />
                    </SearchContainer>
                  </FiltersContainer>
                  {hasSetupOneFeedback || hasSlug ? (
                    <Fragment>
                      <SummaryListContainer style={{gridArea: 'list'}}>
                        <FeedbackSummaryCategories />
                        <Container>
                          <FeedbackList />
                        </Container>
                      </SummaryListContainer>
                      <Container style={{gridArea: 'details'}}>
                        <AnalyticsArea name="details">
                          <FeedbackItemLoader />
                        </AnalyticsArea>
                      </Container>
                    </Fragment>
                  ) : (
                    <SetupContainer>
                      <FeedbackSetupPanel />
                    </SetupContainer>
                  )}
                </LayoutGrid>
              </Background>
            </ErrorBoundary>
          </PageFiltersContainer>
        </FeedbackQueryKeys>
      </FullViewport>
    </SentryDocumentTitle>
  );
}

const Background = styled('div')`
  background: ${p => p.theme.background};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: ${space(2)};
`;

const SummaryListContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  min-height: 0; /* Allow flex children to shrink */
  overflow: hidden; /* Ensure proper scrolling behavior */
`;

const LayoutGrid = styled('div')`
  overflow: hidden;
  flex-grow: 1;
  height: 100%;

  display: grid;
  gap: ${space(2)};
  place-items: stretch;

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    padding: ${space(2)};
  }

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding: ${space(2)};
  }

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    padding: ${space(2)} ${space(4)};
  }

  grid-template-rows: max-content 1fr;
  grid-template-areas:
    'top top'
    'list details';

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: 1fr;
    grid-template-rows: max-content minmax(600px, 1fr) max-content;
    grid-template-areas:
      'top'
      'list'
      'details';
  }

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: minmax(195px, 1fr) 1.5fr;
  }

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    grid-template-columns: 390px 1fr;
  }

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    grid-template-columns: minmax(390px, 1fr) 2fr;
  }
`;

const Container = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  min-height: 0; /* Allow flex children to shrink below their content size */
`;

const SetupContainer = styled('div')`
  overflow: hidden;
  grid-column: 1 / -1;
`;

const FiltersContainer = styled('div')`
  display: flex;
  flex-grow: 1;
  gap: ${space(1)};
  align-items: flex-start;
`;

/**
 * Prevent the search box from growing infinitely.
 * See https://github.com/getsentry/sentry/pull/80328
 */
const SearchContainer = styled('div')`
  flex-grow: 1;
  min-width: 0;
`;
