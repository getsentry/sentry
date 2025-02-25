import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {useExploreDataset} from 'sentry/views/explore/contexts/pageParamsContext';
import {SpanTagsProvider} from 'sentry/views/explore/contexts/spanTagsContext';
import {
  useAddQuery,
  useReadQueriesFromLocation,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {QueryRow} from 'sentry/views/explore/multiQueryMode/queryRow';

const MAX_QUERIES_ALLOWED = 5;

function Content() {
  const queries = useReadQueriesFromLocation().slice(0, MAX_QUERIES_ALLOWED);
  const addQuery = useAddQuery();
  const totalQueryRows = queries.length;
  const organization = useOrganization();
  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <StyledPageFilterBar condensed>
          <ProjectPageFilter />
          <EnvironmentPageFilter />
          <DatePageFilter />
        </StyledPageFilterBar>
        <WidgetSyncContextProvider>
          {queries.map((query, index) => (
            <QueryRow
              key={index}
              query={query}
              index={index}
              totalQueryRows={totalQueryRows}
            />
          ))}
        </WidgetSyncContextProvider>
        <Button
          aria-label={t('Add Query')}
          onClick={() => {
            trackAnalytics('compare_queries.add_query', {
              num_queries: totalQueryRows + 1,
              organization,
            });
            addQuery();
          }}
          icon={<IconAdd />}
          disabled={queries.length >= MAX_QUERIES_ALLOWED}
        >
          {t('Add Query')}
        </Button>
      </Layout.Main>
    </Layout.Body>
  );
}

export function MultiQueryModeContent() {
  const dataset = useExploreDataset();
  return (
    <SpanTagsProvider dataset={dataset} enabled>
      <Content />
    </SpanTagsProvider>
  );
}

const StyledPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(2)};
`;
