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
import {useExploreDataset} from 'sentry/views/explore/contexts/pageParamsContext';
import {SpanTagsProvider} from 'sentry/views/explore/contexts/spanTagsContext';
import {
  useAddQuery,
  useReadQueriesFromLocation,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {QueryRow} from 'sentry/views/explore/multiQueryMode/queryRow';

function Content() {
  const queries = useReadQueriesFromLocation();
  const addQuery = useAddQuery();
  const disableDelete = queries.length === 1;
  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <StyledPageFilterBar condensed>
          <ProjectPageFilter />
          <EnvironmentPageFilter />
          <DatePageFilter />
        </StyledPageFilterBar>
        {queries.map((query, index) => (
          <QueryRow
            key={index}
            query={query}
            index={index}
            disableDelete={disableDelete}
          />
        ))}
        <Button
          aria-label={t('Add Query')}
          onClick={addQuery}
          icon={<IconAdd />}
          disabled={queries.length >= 5}
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
