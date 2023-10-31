import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {FeedbackDataContext} from 'sentry/components/feedback/feedbackDataContext';
import FeedbackFilters from 'sentry/components/feedback/feedbackFilters';
import FeedbackItemLoader from 'sentry/components/feedback/feedbackItem/feedbackItemLoader';
import FeedbackList from 'sentry/components/feedback/list/feedbackList';
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

interface Props extends RouteComponentProps<{}, {}, {}> {}

export default function FeedbackListPage({}: Props) {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={t('User Feedback')} orgSlug={organization.slug}>
      <FullViewport>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{t('User Feedback')}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
        <PageFiltersContainer>
          <ErrorBoundary>
            <FeedbackDataContext>
              <LayoutGrid>
                <FeedbackFilters style={{gridArea: 'filters'}} />
                <Container style={{gridArea: 'list'}}>
                  <FeedbackList />
                </Container>
                <Container style={{gridArea: 'details'}}>
                  <FeedbackItemLoader />
                </Container>
              </LayoutGrid>
            </FeedbackDataContext>
          </ErrorBoundary>
        </PageFiltersContainer>
      </FullViewport>
    </SentryDocumentTitle>
  );
}

const LayoutGrid = styled('div')`
  background: ${p => p.theme.background};

  height: 100%;
  width: 100%;
  padding: ${space(2)} ${space(4)};
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
