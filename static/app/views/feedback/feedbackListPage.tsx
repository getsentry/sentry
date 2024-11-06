import {Fragment} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackFilters from 'sentry/components/feedback/feedbackFilters';
import FeedbackItemLoader from 'sentry/components/feedback/feedbackItem/feedbackItemLoader';
import FeedbackWidgetBanner from 'sentry/components/feedback/feedbackOnboarding/feedbackWidgetBanner';
import FeedbackSearch from 'sentry/components/feedback/feedbackSearch';
import FeedbackSetupPanel from 'sentry/components/feedback/feedbackSetupPanel';
import FeedbackWhatsNewBanner from 'sentry/components/feedback/feedbackWhatsNewBanner';
import FeedbackList from 'sentry/components/feedback/list/feedbackList';
import useCurrentFeedbackId from 'sentry/components/feedback/useCurrentFeedbackId';
import useHaveSelectedProjectsSetupFeedback, {
  useHaveSelectedProjectsSetupNewFeedback,
} from 'sentry/components/feedback/useFeedbackOnboarding';
import {FeedbackQueryKeys} from 'sentry/components/feedback/useFeedbackQueryKeys';
import useRedirectToFeedbackFromEvent from 'sentry/components/feedback/useRedirectToFeedbackFromEvent';
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {feedbackWidgetPlatforms} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

interface Props extends RouteComponentProps<{}, {}, {}> {}

export default function FeedbackListPage({}: Props) {
  const organization = useOrganization();
  const {hasSetupOneFeedback} = useHaveSelectedProjectsSetupFeedback();
  const {hasSetupNewFeedback} = useHaveSelectedProjectsSetupNewFeedback();

  const showWhatsNewBanner = hasSetupOneFeedback && !hasSetupNewFeedback;

  useRedirectToFeedbackFromEvent();

  const feedbackId = useCurrentFeedbackId();
  const hasSlug = Boolean(feedbackId);

  const pageFilters = usePageFilters();
  const projects = useProjects();

  const selectedProjects = projects.projects.filter(p =>
    pageFilters.selection.projects.includes(Number(p.id))
  );

  // one selected project is widget eligible
  const oneIsWidgetEligible = selectedProjects.some(p =>
    feedbackWidgetPlatforms.includes(p.platform!)
  );

  const showWidgetBanner = showWhatsNewBanner && oneIsWidgetEligible;

  return (
    <SentryDocumentTitle title={t('User Feedback')} orgSlug={organization.slug}>
      <FullViewport>
        <FeedbackQueryKeys organization={organization}>
          <Layout.Header>
            <Layout.HeaderContent>
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
              <LayoutGrid data-banner={showWhatsNewBanner}>
                {showWidgetBanner ? (
                  <FeedbackWidgetBanner style={{gridArea: 'banner'}} />
                ) : showWhatsNewBanner ? (
                  <FeedbackWhatsNewBanner style={{gridArea: 'banner'}} />
                ) : null}
                <FeedbackFilters style={{gridArea: 'filters'}} />
                {hasSetupOneFeedback || hasSlug ? (
                  <Fragment>
                    <Container style={{gridArea: 'list'}}>
                      <FeedbackList />
                    </Container>
                    <SearchContainer>
                      <FeedbackSearch />
                    </SearchContainer>
                    <Container style={{gridArea: 'details'}}>
                      <FeedbackItemLoader />
                    </Container>
                  </Fragment>
                ) : (
                  <SetupContainer>
                    <FeedbackSetupPanel />
                  </SetupContainer>
                )}
              </LayoutGrid>
            </ErrorBoundary>
          </PageFiltersContainer>
        </FeedbackQueryKeys>
      </FullViewport>
    </SentryDocumentTitle>
  );
}

const LayoutGrid = styled('div')`
  background: ${p => p.theme.background};
  overflow: hidden;

  flex-grow: 1;

  display: grid;
  gap: ${space(2)};
  place-items: stretch;

  grid-template-rows: max-content 1fr;
  grid-template-areas:
    'filters search'
    'list details';

  &[data-banner='true'] {
    grid-template-rows: max-content max-content 1fr;
    grid-template-areas:
      'banner banner'
      'filters search'
      'list details';
  }

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(2)};
    grid-template-columns: 1fr;
    grid-template-areas:
      'filters'
      'search'
      'list'
      'details';

    &[data-banner='true'] {
      grid-template-areas:
        'banner'
        'filters'
        'search'
        'list'
        'details';
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(2)};
    grid-template-columns: minmax(1fr, 195px) 1fr;
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    padding: ${space(2)} ${space(4)} ${space(2)} ${space(4)};
    grid-template-columns: 390px 1fr;
  }
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: minmax(390px, 1fr) 2fr;
  }
`;

const Container = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const SetupContainer = styled('div')`
  overflow: hidden;
  grid-column: 1 / -1;
`;

const SearchContainer = styled('div')`
  flex-grow: 1;
  min-width: 0;
`;
