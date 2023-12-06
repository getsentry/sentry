import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackFilters from 'sentry/components/feedback/feedbackFilters';
import FeedbackItemLoader from 'sentry/components/feedback/feedbackItem/feedbackItemLoader';
import FeedbackSearch from 'sentry/components/feedback/feedbackSearch';
import FeedbackSetupPanel from 'sentry/components/feedback/feedbackSetupPanel';
import FeedbackList from 'sentry/components/feedback/list/feedbackList';
import OldFeedbackButton from 'sentry/components/feedback/oldFeedbackButton';
import useCurrentFeedbackId from 'sentry/components/feedback/useCurrentFeedbackId';
import {FeedbackQueryKeys} from 'sentry/components/feedback/useFeedbackQueryKeys';
import useHaveSelectedProjectsSetupFeedback from 'sentry/components/feedback/useHaveSelectedProjectsSetupFeedback';
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

interface Props extends RouteComponentProps<{}, {}, {}> {}

export default function FeedbackListPage({}: Props) {
  const organization = useOrganization();
  const {hasSetupOneFeedback} = useHaveSelectedProjectsSetupFeedback();

  const feedbackSlug = useCurrentFeedbackId();
  const hasSlug = Boolean(feedbackSlug);

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
            <Layout.HeaderActions>
              <OldFeedbackButton />
            </Layout.HeaderActions>
          </Layout.Header>
          <PageFiltersContainer>
            <ErrorBoundary>
              <LayoutGrid>
                <FeedbackFilters style={{gridArea: 'filters'}} />
                {hasSetupOneFeedback || hasSlug ? (
                  <Fragment>
                    <Container style={{gridArea: 'list'}}>
                      <FeedbackList />
                    </Container>
                    <FeedbackSearch style={{gridArea: 'search'}} />
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
  padding: ${space(2)} ${space(4)} ${space(2)} ${space(4)};
  overflow: hidden;

  flex-grow: 1;

  display: grid;
  gap: ${space(2)};
  place-items: stretch;

  grid-template-columns: minmax(390px, 1fr) 2fr;
  grid-template-rows: max-content 1fr;
  grid-template-areas:
    'filters search'
    'list details';
`;

const Container = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const SetupContainer = styled('div')`
  overflow: hidden;
  grid-column: 1 / -1;
`;
