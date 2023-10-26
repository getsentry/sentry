import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import FeedbackEmptyDetails from 'sentry/components/feedback/details/feedbackEmptyDetails';
import {FeedbackDataContext} from 'sentry/components/feedback/feedbackDataContext';
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
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

interface Props extends RouteComponentProps<{}, {}, {}> {}

export default function FeedbackListPage({}: Props) {
  const organization = useOrganization();

  const queryView = useLocationQuery({
    fields: {
      collapse: ['inbox'],
      expand: [
        'owners', // Gives us assignment
        'stats', // Gives us `firstSeen`
      ],
      limit: 25,
      queryReferrer: 'feedback_list_page',
      shortIdLookup: 0,
      end: decodeScalar,
      environment: decodeList,
      field: decodeList,
      project: decodeList,
      query: decodeScalar,
      start: decodeScalar,
      statsPeriod: decodeScalar,
      utc: decodeScalar,
      mailbox: decodeMailbox,
    },
  });
  const {feedbackSlug} = useLocationQuery({
    fields: {
      feedbackSlug: decodeScalar,
    },
  });

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
            <FeedbackDataContext queryView={queryView}>
              <LayoutGrid>
                <FeedbackFilters style={{gridArea: 'filters'}} />
                <FeedbackSearch style={{gridArea: 'search'}} />
                <Container style={{gridArea: 'list'}}>
                  <FeedbackList />
                </Container>
                <Container style={{gridArea: 'details'}}>
                  {feedbackSlug ? (
                    <FeedbackItemLoader feedbackSlug={feedbackSlug} />
                  ) : (
                    <FeedbackEmptyDetails />
                  )}
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
    'filters search'
    'list details';
  gap: ${space(2)};
  place-items: stretch;
`;

const Container = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;
