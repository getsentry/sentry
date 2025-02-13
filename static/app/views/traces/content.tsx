import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {browserHistory} from 'sentry/utils/browserHistory';
import {decodeInteger} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {ExploreContent} from 'sentry/views/explore/content';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';

import {usePageParams} from './hooks/usePageParams';
import {useTraces} from './hooks/useTraces';
import {TracesChart} from './tracesChart';
import {TracesSearchBar} from './tracesSearchBar';
import {TracesTable} from './tracesTable';
import {normalizeTraces} from './utils';

const TRACE_EXPLORER_DOCS_URL = 'https://docs.sentry.io/product/explore/traces/';
const DEFAULT_STATS_PERIOD = '24h';
const DEFAULT_PER_PAGE = 50;

export default function Wrapper(props: any) {
  const location = useLocation();
  const organization = useOrganization();

  if (
    location.query.view !== 'trace' &&
    organization.features.includes('visibility-explore-view')
  ) {
    return <ExploreContent {...props} />;
  }

  return <Content {...props} />;
}

function Content() {
  const location = useLocation();
  const organization = useOrganization();

  const limit = useMemo(() => {
    return decodeInteger(location.query.perPage, DEFAULT_PER_PAGE);
  }, [location.query.perPage]);

  const {queries} = usePageParams(location);

  const handleSearch = useCallback(
    (searchIndex: number, searchQuery: string) => {
      const newQueries = [...queries];
      if (newQueries.length === 0) {
        // In the odd case someone wants to add search bars before any query has been made, we add both the default one shown and a new one.
        newQueries[0] = '';
      }
      newQueries[searchIndex] = searchQuery;
      browserHistory.push({
        ...location,
        query: {
          ...location.query,
          cursor: undefined,
          query: typeof searchQuery === 'string' ? newQueries : queries,
        },
      });
    },
    [location, queries]
  );

  const handleClearSearch = useCallback(
    (searchIndex: number) => {
      const newQueries = [...queries];
      // TODO: do we need to return false when `newQueries[searchIndex] === undefined`?
      delete newQueries[searchIndex];
      browserHistory.push({
        ...location,
        query: {
          ...location.query,
          cursor: undefined,
          query: newQueries,
        },
      });
      return true;
    },
    [location, queries]
  );

  const tracesQuery = useTraces({
    limit,
    query: queries,
  });

  const isLoading = tracesQuery.isFetching;
  const isError = !isLoading && tracesQuery.isError;
  const isEmpty = !isLoading && !isError && (tracesQuery?.data?.data?.length ?? 0) === 0;
  const rawData = !isLoading && !isError ? tracesQuery?.data?.data : undefined;
  const data = normalizeTraces(rawData);

  return (
    <SentryDocumentTitle title={t('Traces')} orgSlug={organization.slug}>
      <PageFiltersContainer
        defaultSelection={{
          datetime: {start: null, end: null, utc: null, period: DEFAULT_STATS_PERIOD},
        }}
      >
        <Layout.Page>
          <Layout.Header>
            <Layout.HeaderContent>
              <HeaderContentBar>
                <Layout.Title>
                  {t('Traces')}
                  <PageHeadingQuestionTooltip
                    docsUrl={TRACE_EXPLORER_DOCS_URL}
                    title={t(
                      'Traces lets you search for individual spans that make up a trace, linked by a trace id.'
                    )}
                  />
                </Layout.Title>
                <FeedbackWidgetButton />
              </HeaderContentBar>
            </Layout.HeaderContent>
          </Layout.Header>
          <Layout.Body>
            <LayoutMain fullWidth>
              <PageFilterBar condensed>
                <ProjectPageFilter />
                <EnvironmentPageFilter />
                <DatePageFilter defaultPeriod="2h" />
              </PageFilterBar>
              {isError && typeof tracesQuery.error?.responseJSON?.detail === 'string' ? (
                <Alert margin={false} type="error" showIcon>
                  {tracesQuery.error?.responseJSON?.detail}
                </Alert>
              ) : null}
              <TracesSearchBar
                queries={queries}
                handleSearch={handleSearch}
                handleClearSearch={handleClearSearch}
              />

              <ModuleLayout.Full>
                <TracesChart />
              </ModuleLayout.Full>
              <TracesTable
                isEmpty={isEmpty}
                isError={isError}
                isLoading={isLoading}
                queries={queries}
                data={data}
              />
            </LayoutMain>
          </Layout.Body>
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const HeaderContentBar = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-direction: row;
`;

const LayoutMain = styled(Layout.Main)`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;
