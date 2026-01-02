import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Flex} from '@sentry/scraps/layout';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openSaveQueryModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import type {DatePageFilterProps} from 'sentry/components/organizations/datePageFilter';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {encodeSort} from 'sentry/utils/discover/eventView';
import {valueIsEqual} from 'sentry/utils/object/valueIsEqual';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useLocation} from 'sentry/utils/useLocation';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {getIdFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/id';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {useSaveMultiQuery} from 'sentry/views/explore/hooks/useSaveMultiQuery';
import {useVisitQuery} from 'sentry/views/explore/hooks/useVisitQuery';
import {
  useAddQuery,
  useReadQueriesFromLocation,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {QueryRow} from 'sentry/views/explore/multiQueryMode/queryRow';
import {TraceItemDataset} from 'sentry/views/explore/types';

export const MAX_QUERIES_ALLOWED = 5;

interface ContentProps {
  datePageFilterProps: DatePageFilterProps;
}

function Content({datePageFilterProps}: ContentProps) {
  const location = useLocation();
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const {saveQuery, updateQuery} = useSaveMultiQuery();
  const queries = useReadQueriesFromLocation().slice(0, MAX_QUERIES_ALLOWED);
  const addQuery = useAddQuery();
  const totalQueryRows = queries.length;
  const id = getIdFromLocation(location);

  const visitQuery = useVisitQuery();
  useEffect(() => {
    if (id) {
      visitQuery(id);
    }
  }, [id, visitQuery]);

  const {data: savedQuery, isLoading: isLoadingSavedQuery} = useGetSavedQuery(id);

  const shouldHighlightSaveButton = useMemo(() => {
    if (isLoadingSavedQuery || savedQuery === undefined) {
      return false;
    }
    return queries.some(({sortBys, query, groupBys, fields, yAxes, chartType}, index) => {
      const singleQuery = savedQuery?.query[index];
      const locationSortByString = sortBys[0] ? encodeSort(sortBys[0]) : undefined;

      // Compares editable fields from saved query with location params to check for changes
      const hasChangesArray = [
        !valueIsEqual(query, singleQuery?.query),
        !valueIsEqual(groupBys, singleQuery?.groupby),
        !valueIsEqual(locationSortByString, singleQuery?.orderby),
        !valueIsEqual(fields, singleQuery?.fields),
        !valueIsEqual(
          yAxes.map(yAxis => ({yAxes: [yAxis], chartType})),
          singleQuery?.visualize,
          true
        ),
        !valueIsEqual(savedQuery.projects, pageFilters.selection.projects),
        !valueIsEqual(savedQuery.environment, pageFilters.selection.environments),
        (defined(savedQuery.start) ? new Date(savedQuery.start).getTime() : null) !==
          (pageFilters.selection.datetime.start
            ? new Date(pageFilters.selection.datetime.start).getTime()
            : null),
        (defined(savedQuery.end) ? new Date(savedQuery.end).getTime() : null) !==
          (pageFilters.selection.datetime.end
            ? new Date(pageFilters.selection.datetime.end).getTime()
            : null),
        (savedQuery.range ?? null) !== pageFilters.selection.datetime.period,
      ];
      return hasChangesArray.some(Boolean);
    });
  }, [
    isLoadingSavedQuery,
    savedQuery,
    queries,
    pageFilters.selection.projects,
    pageFilters.selection.environments,
    pageFilters.selection.datetime.start,
    pageFilters.selection.datetime.end,
    pageFilters.selection.datetime.period,
  ]);

  return (
    <Layout.Body>
      <Layout.Main width="full">
        <Flex justify="between" align="center">
          <StyledPageFilterBar condensed>
            <ProjectPageFilter />
            <EnvironmentPageFilter />
            <DatePageFilter {...datePageFilterProps} />
          </StyledPageFilterBar>
          <DropdownMenu
            items={[
              ...(id
                ? [
                    {
                      key: 'update-query',
                      label: t('Existing Query'),
                      onAction: async () => {
                        try {
                          addLoadingMessage(t('Updating query...'));
                          await updateQuery();
                          addSuccessMessage(t('Query updated successfully'));
                          trackAnalytics('trace_explorer.save_as', {
                            save_type: 'update_query',
                            ui_source: 'toolbar',
                            organization,
                          });
                        } catch (error) {
                          addErrorMessage(t('Failed to update query'));
                          Sentry.captureException(error);
                        }
                      },
                    },
                  ]
                : []),
              {
                key: 'save-query',
                label: t('A New Query'),
                onAction: () => {
                  trackAnalytics('trace_explorer.save_query_modal', {
                    action: 'open',
                    save_type: 'save_new_query',
                    ui_source: 'toolbar',
                    organization,
                  });
                  openSaveQueryModal({
                    organization,
                    saveQuery,
                    source: 'toolbar',
                    traceItemDataset: TraceItemDataset.SPANS,
                  });
                },
              },
            ]}
            trigger={triggerProps => (
              <Button
                {...triggerProps}
                priority={shouldHighlightSaveButton ? 'primary' : 'default'}
                aria-label={t('Save')}
                onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();

                  triggerProps.onClick?.(e);
                }}
              >
                {shouldHighlightSaveButton ? `${t('Save')}` : `${t('Save as')}\u2026`}
              </Button>
            )}
          />
        </Flex>
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
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });
  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);

  return (
    <PageFiltersContainer maxPickableDays={datePageFilterProps.maxPickableDays}>
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <Content datePageFilterProps={datePageFilterProps} />
      </TraceItemAttributeProvider>
    </PageFiltersContainer>
  );
}

const StyledPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(1)};
`;
