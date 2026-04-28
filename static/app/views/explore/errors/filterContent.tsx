import {Grid} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import {SchemaHintsList} from 'sentry/views/explore/components/schemaHints/schemaHintsList';
import {SchemaHintsSources} from 'sentry/views/explore/components/schemaHints/schemaHintsUtils';
import {ExploreSchemaHintsSection} from 'sentry/views/explore/components/styles';
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
        {/* TODO: add in min-content column for cross event querying when that's implemented */}
        <Grid gap="md" columns={{sm: '1fr', md: 'minmax(300px, auto) 1fr'}}>
          <StyledPageFilterBar condensed>
            <ProjectPageFilter />
            <EnvironmentPageFilter />
            <DatePageFilter />
          </StyledPageFilterBar>

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
        </Grid>
        <ExploreSchemaHintsSection>
          <SchemaHintsList
            supportedAggregates={[]}
            booleanTags={{}}
            numberTags={{}}
            stringTags={{}}
            isLoading={false}
            exploreQuery=""
            source={SchemaHintsSources.ERRORS}
          />
        </ExploreSchemaHintsSection>
      </SearchQueryBuilderProvider>
    </Layout.Main>
  );
}
