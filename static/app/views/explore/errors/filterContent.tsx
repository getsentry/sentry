import {Container, Grid} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {StyledPageFilterBar} from 'sentry/views/explore/spans/spansTabSearchSection';
import {TraceItemDataset} from 'sentry/views/explore/types';

export function ErrorsFilterSection() {
  return (
    <Layout.Main width="full">
      <SearchQueryBuilderProvider
        filterKeys={{}}
        getTagValues={() => Promise.resolve([])}
        initialQuery=""
        searchSource="errors-filter"
        placeholder={t('Search for errors, users, tags, and more')}
      >
        <Grid
          areas={{
            zero: `
              "filters"
              "search"
            `,
            '3xl': '"filters search"',
          }}
          columns={{zero: '100%', '3xl': 'minmax(300px, auto) 1fr'}}
          gap="md"
          width="100%"
        >
          <Container area="filters" justifySelf={{zero: 'stretch', sm: 'start'}}>
            <StyledPageFilterBar condensed>
              <ProjectPageFilter />
              <EnvironmentPageFilter />
              <DatePageFilter />
            </StyledPageFilterBar>
          </Container>

          <Container area="search">
            <TraceItemSearchQueryBuilder
              initialQuery=""
              searchSource="errors-filter"
              booleanAttributes={{}}
              booleanSecondaryAliases={{}}
              itemType={TraceItemDataset.ERRORS}
              numberAttributes={{}}
              numberSecondaryAliases={{}}
              stringAttributes={{}}
              stringSecondaryAliases={{}}
            />
          </Container>
        </Grid>
      </SearchQueryBuilderProvider>
    </Layout.Main>
  );
}
