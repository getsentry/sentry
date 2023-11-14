import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackFilters from 'sentry/components/feedback/feedbackFilters';
import FeedbackItemLoader from 'sentry/components/feedback/feedbackItem/feedbackItemLoader';
import FeedbackSetupPanel from 'sentry/components/feedback/feedbackSetupPanel';
import FeedbackList from 'sentry/components/feedback/list/feedbackList';
import {useHaveSelectedProjectsSetupFeedback} from 'sentry/components/feedback/useFeedbackOnboarding';
import {FeedbackQueryKeys} from 'sentry/components/feedback/useFeedbackQueryKeys';
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

interface Props extends RouteComponentProps<{}, {}, {}> {}

export default function FeedbackListPage({}: Props) {
  const organization = useOrganization();
  const {hasSetupOneFeedback} = useHaveSelectedProjectsSetupFeedback();
  const location = useLocation();

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
                title={tct(
                  'View [link:error-associated feedback reports].',
                  {
                    link: (
                      <ExternalLink href="https://docs.sentry.io/product/user-feedback/" />
                    ),
                  }
                )}
                position="left"
                isHoverable
              >
                <Button
                  size="sm"
                  priority="default"
                  to={{
                    pathname: normalizeUrl(
                      `/organizations/${organization.slug}/user-feedback/`
                    ),
                    query: {
                      ...location.query,
                      query: undefined,
                      cursor: undefined,
                    },
                  }}
                >
                  {t('Go to Old User Feedback')}
                </Button>
              </Tooltip>
            </Layout.HeaderActions>
          </Layout.Header>
          <PageFiltersContainer>
            <ErrorBoundary>
              <LayoutGrid>
                <FeedbackFilters style={{gridArea: 'filters'}} />
                {hasSetupOneFeedback ? (
                  <Fragment>
                    <Container style={{gridArea: 'list'}}>
                      <FeedbackList />
                    </Container>
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

  height: 100%;
  width: 100%;
  padding: ${space(2)} ${space(4)} ${space(2)} ${space(4)};
  overflow: hidden;

  display: grid;
  grid-template-columns: minmax(390px, 1fr) 2fr;
  grid-template-rows: max-content 1fr;
  grid-template-areas:
    'filters details'
    'list details';
  gap: ${space(2)};
  place-items: stretch;
`;

const Container = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const SetupContainer = styled('div')`
  grid-column: 1 / 3;
`;
