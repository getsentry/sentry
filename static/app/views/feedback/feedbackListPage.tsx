import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import FeedbackDetails from 'sentry/components/feedback/details/feedbackDetails';
import FeedbackFilters from 'sentry/components/feedback/feedbackFilters';
import FeedbackSearch from 'sentry/components/feedback/feedbackSearch';
import FeedbackTable from 'sentry/components/feedback/table/feedbackTable';
import useFeedbackListQueryParams from 'sentry/components/feedback/useFeedbackListQueryParams';
import useFetchFeedbackList from 'sentry/components/feedback/useFetchFeedbackList';
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {FeedbackListQueryParams} from 'sentry/utils/feedback/types';
import useOrganization from 'sentry/utils/useOrganization';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

interface Props extends RouteComponentProps<{}, {}, FeedbackListQueryParams> {}

export default function FeedbackListPage({location}: Props) {
  const organization = useOrganization();

  const query = useFeedbackListQueryParams({
    location,
    queryReferrer: 'feedback_list_page',
  });
  const {isLoading, isError, data, pageLinks: _} = useFetchFeedbackList({query}, {});

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
            <FluidHeight style={{gridArea: 'list'}}>
              <FeedbackTable
                data={data ?? []}
                isError={isError}
                isLoading={isLoading}
                location={location}
              />
            </FluidHeight>
            <FeedbackDetails style={{gridArea: 'body'}} />
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
  padding: ${space(2)};
  overflow: hidden;

  display: grid;
  grid-template-columns: minmax(390px, 1fr) 2fr;
  grid-template-rows: max-content 1fr;
  grid-template-areas:
    'filters search'
    'list body';
  gap: ${space(2)};
  place-items: stretch;
`;
