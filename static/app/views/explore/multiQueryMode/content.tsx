import {useEffect} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openSaveQueryModal} from 'sentry/actionCreators/modal';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import type {DatePageFilterProps} from 'sentry/components/pageFilters/date/datePageFilter';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useLocation} from 'sentry/utils/useLocation';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {useOrganization} from 'sentry/utils/useOrganization';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {getIdFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/id';
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
                label: t('New Query'),
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
                priority="primary"
                aria-label={t('Save as')}
                onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();

                  triggerProps.onClick?.(e);
                }}
              >
                {t('Save as')}
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
      <Content datePageFilterProps={datePageFilterProps} />
    </PageFiltersContainer>
  );
}

const StyledPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${p => p.theme.space.md};
`;
