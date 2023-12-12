import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackFilters from 'sentry/components/feedback/feedbackFilters';
import FeedbackItemLoader from 'sentry/components/feedback/feedbackItem/feedbackItemLoader';
import FeedbackSearch from 'sentry/components/feedback/feedbackSearch';
import FeedbackSetupPanel from 'sentry/components/feedback/feedbackSetupPanel';
import FeedbackWhatsNewBanner from 'sentry/components/feedback/feedbackWhatsNewBanner';
import FeedbackList from 'sentry/components/feedback/list/feedbackList';
import OldFeedbackButton from 'sentry/components/feedback/oldFeedbackButton';
import useCurrentFeedbackId from 'sentry/components/feedback/useCurrentFeedbackId';
import useHaveSelectedProjectsSetupFeedback, {
  useHaveSelectedProjectsSetupNewFeedback,
} from 'sentry/components/feedback/useFeedbackOnboarding';
import {FeedbackQueryKeys} from 'sentry/components/feedback/useFeedbackQueryKeys';
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

interface Props extends RouteComponentProps<{}, {}, {}> {}

export default function FeedbackListPage({}: Props) {
  const organization = useOrganization();
  const {hasSetupOneFeedback} = useHaveSelectedProjectsSetupFeedback();
  const {hasSetupNewFeedback} = useHaveSelectedProjectsSetupNewFeedback();

  const showWhatsNewBanner = hasSetupOneFeedback && !hasSetupNewFeedback;

  const feedbackSlug = useCurrentFeedbackId();
  const hasSlug = Boolean(feedbackSlug);

  return (
    <SentryDocumentTitle title={t('User Feedback')} orgSlug={organization.slug}>
      <FullViewport>
        <FeedbackQueryKeys organization={organization}>
          <Layout.Header>
            <Layout.HeaderContent>
              <Layout.Title>{t('User Feedback')}</Layout.Title>
            </Layout.HeaderContent>
            <Layout.HeaderActions>
              <Tooltip
                title={tct('View [link:error-associated feedback reports].', {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/product/user-feedback/" />
                  ),
                })}
                position="left"
                isHoverable
              >
                <OldFeedbackButton />
              </Tooltip>
            </Layout.HeaderActions>
          </Layout.Header>
          <PageFiltersContainer>
            <ErrorBoundary>
              <LayoutGrid data-banner={showWhatsNewBanner}>
                {showWhatsNewBanner ? (
                  <FeedbackWhatsNewBanner style={{gridArea: 'banner'}} />
                ) : null}
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

  &[data-banner='true'] {
    grid-template-columns: minmax(390px, 1fr) 2fr;
    grid-template-rows: max-content max-content 1fr;
    grid-template-areas:
      'banner banner'
      'filters search'
      'list details';
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
