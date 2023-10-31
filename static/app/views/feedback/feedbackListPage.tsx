import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackFilters from 'sentry/components/feedback/feedbackFilters';
import FeedbackItemLoader from 'sentry/components/feedback/feedbackItem/feedbackItemLoader';
import FeedbackSearch from 'sentry/components/feedback/feedbackSearch';
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
            <LayoutGrid>
              <FeedbackFilters style={{gridArea: 'filters'}} />
              <FeedbackSearch style={{gridArea: 'search'}} />
              <Container style={{gridArea: 'list'}}>
                <FeedbackList />
              </Container>
              <Container style={{gridArea: 'details'}}>
                <FeedbackItemLoader />
              </Container>
            </LayoutGrid>
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
    'filters search'
    'list details';
  gap: ${space(2)};
  place-items: stretch;
`;

const Container = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;
