import styled from '@emotion/styled';

import {openSaveQueryModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Button} from 'sentry/components/core/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {useExploreDataset} from 'sentry/views/explore/contexts/pageParamsContext';
import {getIdFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/id';
import {SpanTagsProvider} from 'sentry/views/explore/contexts/spanTagsContext';
import {useSaveMultiQuery} from 'sentry/views/explore/hooks/useSaveMultiQuery';
import {
  useAddQuery,
  useReadQueriesFromLocation,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {QueryRow} from 'sentry/views/explore/multiQueryMode/queryRow';
import {limitMaxPickableDays} from 'sentry/views/explore/utils';

export const MAX_QUERIES_ALLOWED = 5;

function Content() {
  const location = useLocation();
  const organization = useOrganization();
  const {saveQuery} = useSaveMultiQuery();
  const {defaultPeriod, maxPickableDays, relativeOptions} =
    limitMaxPickableDays(organization);
  const queries = useReadQueriesFromLocation().slice(0, MAX_QUERIES_ALLOWED);
  const addQuery = useAddQuery();
  const totalQueryRows = queries.length;
  const id = getIdFromLocation(location);

  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <Flex>
          <StyledPageFilterBar condensed>
            <ProjectPageFilter />
            <EnvironmentPageFilter />
            <DatePageFilter
              defaultPeriod={defaultPeriod}
              maxPickableDays={maxPickableDays}
              relativeOptions={relativeOptions}
            />
          </StyledPageFilterBar>
          <Feature features={['performance-saved-queries']}>
            <DropdownMenu
              items={[
                {
                  key: 'save-query',
                  label: (
                    <span>
                      {t('A New Query')}
                      <FeatureBadge type="alpha" />
                    </span>
                  ),
                  onAction: () => {
                    openSaveQueryModal({
                      organization,
                      saveQuery,
                      queries: queries.map((query, index) => ({
                        query: query.query,
                        groupBys: query.groupBys,
                        visualizes: [
                          {
                            chartType: query.chartType,
                            yAxes: query.yAxes,
                            label: `visualization-${index}`,
                          },
                        ],
                      })),
                    });
                  },
                },
                ...(id
                  ? [
                      {
                        key: 'update-query',
                        label: (
                          <span>
                            {t('Existing Query')}
                            <FeatureBadge type="alpha" />
                          </span>
                        ),
                      },
                    ]
                  : []),
              ]}
              trigger={triggerProps => (
                <Button
                  {...triggerProps}
                  aria-label={t('Save')}
                  onClick={e => {
                    e.stopPropagation();
                    e.preventDefault();

                    triggerProps.onClick?.(e);
                  }}
                >
                  {t('Save as...')}
                </Button>
              )}
            />
          </Feature>
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
  const dataset = useExploreDataset();
  return (
    <SpanTagsProvider dataset={dataset} enabled>
      <Content />
    </SpanTagsProvider>
  );
}

const StyledPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(1)};
`;

const Flex = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;
