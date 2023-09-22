import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import FeedbackTable from 'sentry/components/bugReports/table/feedbackTable';
import useFeedbackListQueryParams from 'sentry/components/bugReports/useFeedbackListQueryParams';
import useFetchFeedbackList from 'sentry/components/bugReports/useFetchFeedbackList';
import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import Pagination from 'sentry/components/pagination';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {FeedbackListQueryParams} from 'sentry/utils/feedback/types';
import useOrganization from 'sentry/utils/useOrganization';

interface Props extends RouteComponentProps<{}, {}, FeedbackListQueryParams> {}

export default function BugReportsMainPage({location}: Props) {
  const organization = useOrganization();

  const query = useFeedbackListQueryParams({
    location,
    queryReferrer: 'bugreports_list_page',
  });
  const {isLoading, isError, data, pageLinks} = useFetchFeedbackList({query}, {});

  return (
    <SentryDocumentTitle title={t(`Bug Reports`)} orgSlug={organization.slug}>
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
        <Layout.Body>
          <Layout.Main fullWidth>
            <LayoutGap>
              <PageFilterBar condensed>
                <ProjectPageFilter resetParamsOnChange={['cursor']} />
                <EnvironmentPageFilter resetParamsOnChange={['cursor']} />
                <DatePageFilter alignDropdown="left" resetParamsOnChange={['cursor']} />
              </PageFilterBar>
              <FeedbackTable
                data={data ?? []}
                isError={isError}
                isLoading={isLoading}
                location={location}
              />
            </LayoutGap>
            <PaginationNoMargin
              pageLinks={pageLinks}
              onCursor={(cursor, path, searchQuery) => {
                browserHistory.push({
                  pathname: path,
                  query: {...searchQuery, cursor},
                });
              }}
            />
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;

const PaginationNoMargin = styled(Pagination)`
  margin: 0;
`;
