import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import FeedbackEmptyDetails from 'sentry/components/feedback/details/feedbackEmptyDetails';
import FeedbackFilters from 'sentry/components/feedback/feedbackFilters';
import FeedbackItemLoader from 'sentry/components/feedback/feedbackItem/feedbackItemLoader';
import FeedbackSearch from 'sentry/components/feedback/feedbackSearch';
import FeedbackIndexLoader from 'sentry/components/feedback/index/feedbackIndexLoader';
import useFeedbackListQueryParams from 'sentry/components/feedback/useFeedbackListQueryParams';
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

interface Props extends RouteComponentProps<{}, {}, {}> {}

export default function FeedbackListPage({}: Props) {
  const location = useLocation();
  const query = useFeedbackListQueryParams({
    location,
    queryReferrer: 'feedback_list_page',
  });

  const organization = useOrganization();

  const feedbackSlug = decodeScalar(location.query.feedbackSlug);

  return (
    <SentryDocumentTitle title={t(`Bug Reports`)} orgSlug={organization.slug}>
      <FullViewport>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>
              {t('Bug Reports')}
              <PageHeadingQuestionTooltip
                title={t(
                  'Feedback submitted by users who experienced an error while using your application, including their name, email address, and any additional comments.'
                )}
                docsUrl="https://docs.sentry.io/product/user-feedback/"
              />
            </Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
        <PageFiltersContainer>
          <LayoutGrid>
            <FeedbackFilters style={{gridArea: 'filters'}} />
            <FeedbackSearch style={{gridArea: 'search'}} />
            <Container style={{gridArea: 'list'}}>
              <FeedbackIndexLoader query={query} />
            </Container>
            <Container style={{gridArea: 'details'}}>
              {feedbackSlug ? (
                <FeedbackItemLoader feedbackSlug={feedbackSlug} />
              ) : (
                <FeedbackEmptyDetails />
              )}
            </Container>
          </LayoutGrid>
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
