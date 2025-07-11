import {useMemo} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openSaveQueryModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import {encodeSort} from 'sentry/utils/discover/eventView';
import {parseFunction, prettifyParsedFunction} from 'sentry/utils/discover/fields';
import {valueIsEqual} from 'sentry/utils/object/valueIsEqual';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {
  useExploreFields,
  useExploreGroupBys,
  useExploreId,
  useExploreMode,
  useExploreQuery,
  useExploreSortBys,
  useExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {useAddToDashboard} from 'sentry/views/explore/hooks/useAddToDashboard';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {useSaveQuery} from 'sentry/views/explore/hooks/useSaveQuery';
import {generateExploreCompareRoute} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {ToolbarSection} from 'sentry/views/explore/toolbar/styles';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';

export function ToolbarSaveAs() {
  const {addToDashboard} = useAddToDashboard();
  const {updateQuery, saveQuery} = useSaveQuery();
  const location = useLocation();
  const organization = useOrganization();

  const {projects} = useProjects();
  const pageFilters = usePageFilters();

  const query = useExploreQuery();
  const groupBys = useExploreGroupBys();
  const visualizes = useExploreVisualizes();
  const fields = useExploreFields();
  const sortBys = useExploreSortBys();
  const mode = useExploreMode();
  const id = useExploreId();
  const visualizeYAxes = useMemo(
    () =>
      dedupeArray(
        visualizes.filter(visualize => !visualize.isEquation).map(v => v.yAxis)
      ),
    [visualizes]
  );

  const [interval] = useChartInterval();

  const project =
    projects.length === 1
      ? projects[0]
      : projects.find(p => p.id === `${pageFilters.selection.projects[0]}`);

  const {data: savedQuery, isLoading: isLoadingSavedQuery} = useGetSavedQuery(id);

  const alertsUrls = visualizeYAxes.map((yAxis, index) => {
    const func = parseFunction(yAxis);
    const label = func ? prettifyParsedFunction(func) : yAxis;
    return {
      key: `${yAxis}-${index}`,
      label,
      to: getAlertsUrl({
        project,
        query,
        pageFilters: pageFilters.selection,
        aggregate: yAxis,
        organization,
        dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
        interval,
      }),
      onAction: () => {
        trackAnalytics('trace_explorer.save_as', {
          save_type: 'alert',
          ui_source: 'toolbar',
          organization,
        });
      },
    };
  });

  const items: MenuItemProps[] = [];

  // Explicitly check for false to account for loading state
  if (defined(id) && savedQuery?.isPrebuilt === false) {
    items.push({
      key: 'update-query',
      textValue: t('Existing Query'),
      label: <span>{t('Existing Query')}</span>,
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
    });
  }
  items.push({
    key: 'save-query',
    label: <span>{t('A New Query')}</span>,
    textValue: t('A New Query'),
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
      });
    },
  });

  items.push({
    key: 'create-alert',
    label: t('An Alert for'),
    textValue: t('An Alert for'),
    children: alertsUrls ?? [],
    disabled: !alertsUrls || alertsUrls.length === 0,
    isSubmenu: true,
  });

  const disableAddToDashboard = !organization.features.includes('dashboards-edit');

  const chartOptions = useMemo(() => {
    return visualizeYAxes.map((yAxis, index) => {
      const dedupedYAxes = [yAxis];
      const formattedYAxes = dedupedYAxes.map(yaxis => {
        const func = parseFunction(yaxis);
        return func ? prettifyParsedFunction(func) : undefined;
      });

      return {
        key: String(index),
        label: formattedYAxes.filter(Boolean).join(', '),
        onAction: () => {
          if (disableAddToDashboard) {
            return undefined;
          }

          trackAnalytics('trace_explorer.save_as', {
            save_type: 'dashboard',
            ui_source: 'toolbar',
            organization,
          });
          return addToDashboard(index);
        },
      };
    });
  }, [addToDashboard, disableAddToDashboard, organization, visualizeYAxes]);

  items.push({
    key: 'add-to-dashboard',
    textValue: t('A Dashboard widget'),
    isSubmenu: chartOptions.length > 1 ? true : false,
    label: (
      <Feature
        hookName="feature-disabled:dashboards-edit"
        features="organizations:dashboards-edit"
        renderDisabled={() => <DisabledText>{t('A Dashboard widget')}</DisabledText>}
      >
        {t('A Dashboard widget')}
      </Feature>
    ),
    disabled: disableAddToDashboard,
    children: chartOptions.length > 1 ? chartOptions : undefined,
    onAction: () => {
      if (disableAddToDashboard || chartOptions.length > 1) {
        return undefined;
      }

      trackAnalytics('trace_explorer.save_as', {
        save_type: 'dashboard',
        ui_source: 'toolbar',
        organization,
      });
      return addToDashboard(0);
    },
  });

  const shouldHighlightSaveButton = useMemo(() => {
    if (isLoadingSavedQuery || savedQuery === undefined || savedQuery?.isPrebuilt) {
      return false;
    }
    // The non comparison trace explorer view only supports a single query
    const singleQuery = savedQuery?.query[0];
    const locationSortByString = sortBys[0] ? encodeSort(sortBys[0]) : undefined;

    // Compares editable fields from saved query with location params to check for changes
    const hasChangesArray = [
      !valueIsEqual(query, singleQuery?.query),
      !valueIsEqual(
        groupBys,
        (singleQuery?.groupby?.length ?? 0) === 0 ? [''] : singleQuery?.groupby
      ),
      !valueIsEqual(locationSortByString, singleQuery?.orderby),
      !valueIsEqual(fields, singleQuery?.fields),
      !valueIsEqual(
        visualizes.map(visualize => visualize.toJSON()),
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
  }, [
    isLoadingSavedQuery,
    savedQuery,
    query,
    groupBys,
    sortBys,
    fields,
    visualizes,
    pageFilters.selection.datetime.start,
    pageFilters.selection.datetime.end,
    pageFilters.selection.datetime.period,
    pageFilters.selection.projects,
    pageFilters.selection.environments,
  ]);

  if (items.length === 0) {
    return null;
  }

  return (
    <StyledToolbarSection data-test-id="section-save-as">
      <ButtonBar gap={1}>
        <DropdownMenu
          items={items}
          trigger={triggerProps => (
            <SaveAsButton
              {...triggerProps}
              priority={shouldHighlightSaveButton ? 'primary' : 'default'}
              aria-label={t('Save as')}
              onClick={e => {
                e.stopPropagation();
                e.preventDefault();

                triggerProps.onClick?.(e);
              }}
            >
              {shouldHighlightSaveButton ? `${t('Save')}` : `${t('Save as')}\u2026`}
            </SaveAsButton>
          )}
        />
        <LinkButton
          aria-label={t('Compare')}
          onClick={() =>
            trackAnalytics('trace_explorer.compare', {
              organization,
            })
          }
          to={generateExploreCompareRoute({
            organization,
            mode,
            location,
            queries: [
              {
                query,
                groupBys,
                sortBys,
                yAxes: [visualizeYAxes[0]!],
                chartType: visualizes[0]!.chartType,
              },
            ],
          })}
        >
          {`${t('Compare Queries')}`}
        </LinkButton>
      </ButtonBar>
    </StyledToolbarSection>
  );
}

const DisabledText = styled('span')`
  color: ${p => p.theme.disabled};
`;

const StyledToolbarSection = styled(ToolbarSection)`
  border-top: 1px solid ${p => p.theme.border};
  padding-top: ${space(3)};
`;

const SaveAsButton = styled(Button)`
  width: 100%;
`;
