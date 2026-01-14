import {Fragment, useCallback, useEffect, useState, type ReactNode} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import cloneDeep from 'lodash/cloneDeep';

import {
  fetchDashboard,
  fetchDashboards,
  updateDashboard,
} from 'sentry/actionCreators/dashboards';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Input} from 'sentry/components/core/input';
import {Select} from 'sentry/components/core/select';
import {pageFiltersToQueryParams} from 'sentry/components/organizations/pageFilters/parse';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters, SelectValue} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {Sort} from 'sentry/utils/discover/fields';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import {DashboardCreateLimitWrapper} from 'sentry/views/dashboards/createLimitWrapper';
import {IndexedEventsSelectionAlert} from 'sentry/views/dashboards/indexedEventsSelectionAlert';
import {
  assignDefaultLayout,
  assignTempId,
  calculateColumnDepths,
  getDashboardLayout,
  getInitialColumnDepths,
} from 'sentry/views/dashboards/layoutUtils';
import type {
  DashboardDetails,
  DashboardListItem,
  DashboardWidgetSource,
  Widget,
} from 'sentry/views/dashboards/types';
import {
  DEFAULT_WIDGET_NAME,
  DisplayType,
  MAX_WIDGETS,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {
  eventViewFromWidget,
  getDashboardFiltersFromURL,
  getSavedFiltersAsPageFilters,
  getSavedPageFilters,
  isChartDisplayType,
} from 'sentry/views/dashboards/utils';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {NEW_DASHBOARD_ID} from 'sentry/views/dashboards/widgetBuilder/utils';
import {convertWidgetToBuilderStateParams} from 'sentry/views/dashboards/widgetBuilder/utils/convertWidgetToBuilderStateParams';
import WidgetCard from 'sentry/views/dashboards/widgetCard';
import {DashboardsMEPProvider} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import WidgetLegendNameEncoderDecoder from 'sentry/views/dashboards/widgetLegendNameEncoderDecoder';
import WidgetLegendSelectionState from 'sentry/views/dashboards/widgetLegendSelectionState';
import type {TabularColumn} from 'sentry/views/dashboards/widgets/common/types';
import {MetricsDataSwitcher} from 'sentry/views/performance/landing/metricsDataSwitcher';

export type AddToDashboardModalActions =
  | 'add-and-open-dashboard'
  | 'add-and-stay-on-current-page'
  | 'open-in-widget-builder';

export type AddToDashboardModalProps = {
  location: Location;
  organization: Organization;
  selection: PageFilters;
  // There must always be at least one widget for this component
  widgets: [Widget, ...Widget[]];
  actions?: AddToDashboardModalActions[];
  source?: DashboardWidgetSource;
};

type Props = ModalRenderProps & AddToDashboardModalProps;

const SELECT_DASHBOARD_MESSAGE = t('Select a dashboard');

const DEFAULT_ACTIONS: AddToDashboardModalActions[] = [
  'add-and-stay-on-current-page',
  'open-in-widget-builder',
];

const WIDGET_PREVIEW_HEIGHT = '200px';

function getFallbackWidgetTitle(widget: Widget): string {
  // Metric widgets have their default title derived from the query
  return widget.title === '' && widget.widgetType === WidgetType.METRICS
    ? DEFAULT_WIDGET_NAME
    : widget.title;
}

function AddToDashboardModal({
  Header,
  Body,
  Footer,
  closeModal,
  location,
  organization,
  selection,
  widgets,
  actions = DEFAULT_ACTIONS,
  source,
}: Props) {
  const api = useApi();
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState<DashboardListItem[] | null>(null);
  const [selectedDashboard, setSelectedDashboard] = useState<DashboardDetails | null>(
    null
  );
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);
  const widget = widgets[0];
  const [newWidgetTitle, setNewWidgetTitle] = useState<string>(
    getFallbackWidgetTitle(widget)
  );
  const [orderBy, setOrderBy] = useState<string>();
  const [tableWidths, setTableWidths] = useState<number[]>();

  const {dashboardId: currentDashboardId} = useParams<{dashboardId: string}>();

  // Check if we have multiple widgets to adjust UI accordingly
  const hasMultipleWidgets = widgets.length > 1;

  const handleWidgetTableSort = (sort: Sort) => {
    const newOrderBy = `${sort.kind === 'desc' ? '-' : ''}${sort.field}`;
    setOrderBy(newOrderBy);
  };

  const handleWidgetTableColumnResize = (columns: TabularColumn[]) => {
    const widths = columns.map(column => column.width as number);
    setTableWidths(widths);
  };

  // Set custom title, or fallback to default title for widget
  const updateWidgetTitle = (newTitle: string) => {
    if (newTitle === '') {
      setNewWidgetTitle(getFallbackWidgetTitle(widget));
      return;
    }
    setNewWidgetTitle(newTitle);
  };

  useEffect(() => {
    // Track mounted state so we dont call setState on unmounted components
    let unmounted = false;

    fetchDashboards(api, organization.slug).then(response => {
      // If component has unmounted, dont set state
      if (unmounted) {
        return;
      }

      setDashboards(response);
    });

    return () => {
      unmounted = true;
    };
  }, [api, organization.slug]);

  useEffect(() => {
    // Track mounted state so we dont call setState on unmounted components
    let unmounted = false;

    if (selectedDashboardId === NEW_DASHBOARD_ID || selectedDashboardId === null) {
      setSelectedDashboard(null);
    } else {
      fetchDashboard(api, organization.slug, selectedDashboardId).then(response => {
        // If component has unmounted, dont set state
        if (unmounted) {
          return;
        }

        setSelectedDashboard(response);
      });
    }

    return () => {
      unmounted = true;
    };
  }, [api, organization.slug, selectedDashboardId]);

  function goToDashboard(page: 'builder' | 'preview', widgetsState?: Widget[]) {
    const dashboardsPath =
      selectedDashboardId === NEW_DASHBOARD_ID
        ? `/organizations/${organization.slug}/dashboards/new/`
        : `/organizations/${organization.slug}/dashboard/${selectedDashboardId}/`;

    const builderSuffix = 'widget-builder/widget/new/';

    const pathname =
      page === 'builder' ? `${dashboardsPath}${builderSuffix}` : dashboardsPath;

    const widgetAsQueryParams = convertWidgetToBuilderStateParams(
      normalizeWidgets([widget])[0]!
    );
    navigate(
      normalizeUrl({
        pathname,
        query: {
          ...widgetAsQueryParams,
          title: newWidgetTitle,
          sort: orderBy ?? widgetAsQueryParams.sort,
          source,
          ...(selectedDashboard
            ? getSavedPageFilters(selectedDashboard)
            : pageFiltersToQueryParams(selection)),
        },
      }),
      {state: {widgets: widgetsState ?? []}}
    );
    closeModal();
  }

  function normalizeWidgets(widgetsToNormalize: Widget[]): Widget[] {
    return widgetsToNormalize.map(w => {
      let newOrderBy = orderBy ?? w.queries[0]!.orderby;
      if (
        w.displayType === DisplayType.BIG_NUMBER ||
        w.displayType === DisplayType.WHEEL ||
        (isChartDisplayType(w.displayType) && w.queries[0]!.columns.length === 0)
      ) {
        newOrderBy = ''; // Clear orderby if its not a top n visualization.
      }
      const queries = w.queries.map(query => ({
        ...query,
        orderby: newOrderBy,
      }));

      return {
        ...w,
        title: hasMultipleWidgets ? (w.title ?? DEFAULT_WIDGET_NAME) : newWidgetTitle,
        queries,
      };
    });
  }

  async function handleAddAndStayOnCurrentPage() {
    try {
      await handleAddWidgetsToExistingDashboard();
      addSuccessMessage(
        tn(
          'Successfully added widget to dashboard',
          'Successfully added widgets to dashboard',
          widgets.length
        )
      );
      closeModal();
    } catch (error) {
      addErrorMessage(
        tn(
          'Failed to add widget to dashboard',
          'Failed to add widgets to dashboard',
          widgets.length
        )
      );
    }
  }

  async function handleAddAndOpenDashboard() {
    if (!canSubmit) {
      return;
    }

    // For new dashboards, use location state since there's no dashboard to update yet
    if (selectedDashboardId === NEW_DASHBOARD_ID) {
      // Assign tempIds and default layouts to widgets before passing via location state
      const widgetsWithTempIds = widgets.map(w => assignTempId(w));
      const widgetsWithLayouts = assignDefaultLayout(
        widgetsWithTempIds,
        getInitialColumnDepths()
      );

      goToDashboard('preview', normalizeWidgets(widgetsWithLayouts));
      return;
    }

    // For existing dashboards, add widgets via API first, then navigate
    try {
      addLoadingMessage(
        tn(
          'Adding widget to dashboard...',
          'Adding widgets to dashboard...',
          widgets.length
        )
      );
      await handleAddWidgetsToExistingDashboard();
      addSuccessMessage(
        tn(
          'Successfully added widget to dashboard',
          'Successfully added widgets to dashboard',
          widgets.length
        )
      );

      // Navigate to dashboard (widgets already saved, no location state needed)
      goToDashboard('preview');
    } catch (error) {
      addErrorMessage(
        tn(
          'Failed to add widget to dashboard',
          'Failed to add widgets to dashboard',
          widgets.length
        )
      );
    }
  }

  async function handleAddWidgetsToExistingDashboard() {
    if (selectedDashboard === null) {
      return;
    }

    // Calculate column depths from existing widgets
    const existingLayout = getDashboardLayout(selectedDashboard.widgets);
    const columnDepths = calculateColumnDepths(existingLayout);

    // Assign tempIds and default layouts to new widgets
    const widgetsWithTempIds = widgets.map(w => assignTempId(w));
    const widgetsWithLayouts = assignDefaultLayout(widgetsWithTempIds, columnDepths);

    // Add all widgets to the dashboard
    const newDashboard = {
      ...selectedDashboard,
      widgets: [...selectedDashboard.widgets, ...normalizeWidgets(widgetsWithLayouts)],
    };

    await updateDashboard(api, organization.slug, newDashboard);
  }

  const canSubmit = selectedDashboardId !== null;

  const getOptions = useCallback(
    (
      hasReachedDashboardLimit: boolean,
      isLoading: boolean,
      limitMessage: ReactNode | null
    ) => {
      if (dashboards === null) {
        return null;
      }

      return [
        {
          label: t('+ Create New Dashboard'),
          value: 'new',
          disabled: hasReachedDashboardLimit || isLoading,
          tooltip: hasReachedDashboardLimit ? limitMessage : undefined,
          tooltipOptions: {position: 'right', isHoverable: true},
        },
        ...dashboards
          .filter(dashboard => !defined(dashboard.prebuiltId)) // Cannot add to prebuilt dashboards
          .filter(dashboard =>
            // if adding from a dashboard, currentDashboardId will be set and we'll remove it from the list of options
            currentDashboardId ? dashboard.id !== currentDashboardId : true
          )
          .map(({title, id, widgetDisplay}) => ({
            label: title,
            value: id,
            disabled: widgetDisplay.length + widgets.length >= MAX_WIDGETS,
            tooltip:
              widgetDisplay.length + widgets.length >= MAX_WIDGETS &&
              tct('Max widgets ([maxWidgets]) per dashboard reached.', {
                maxWidgets: MAX_WIDGETS,
              }),
            tooltipOptions: {position: 'right'},
          })),
      ].filter(Boolean) as Array<SelectValue<string>>;
    },
    [currentDashboardId, dashboards, widgets.length]
  );

  const widgetLegendState = new WidgetLegendSelectionState({
    location,
    navigate,
    organization,
    dashboard: selectedDashboard,
  });

  const unselectedReleasesForCharts = {
    [WidgetLegendNameEncoderDecoder.encodeSeriesNameForLegend('Releases', widget.id)]:
      false,
  };

  // Used to refresh sort in table widgets
  const getUpdatedWidgetQueries = () => {
    if (orderBy && widget.queries[0]?.orderby) {
      const queries = cloneDeep(widget.queries);
      queries[0]!.orderby = orderBy;
      return queries;
    }

    return widget.queries;
  };

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Add to Dashboard')}</h4>
      </Header>
      <Body>
        <Wrapper>
          <DashboardCreateLimitWrapper>
            {({hasReachedDashboardLimit, isLoading, limitMessage}) => (
              <Select
                disabled={dashboards === null}
                name="dashboard"
                placeholder={t('Select Dashboard')}
                value={selectedDashboardId}
                options={getOptions(hasReachedDashboardLimit, isLoading, limitMessage)}
                onChange={(option: SelectValue<string>) => {
                  if (option.disabled) {
                    return;
                  }
                  setSelectedDashboardId(option.value);
                }}
              />
            )}
          </DashboardCreateLimitWrapper>
        </Wrapper>
        {!hasMultipleWidgets && (
          <Wrapper>
            <SectionHeader title={t('Widget Name')} optional />
            <Input
              type="text"
              aria-label={t('Optional Widget Name')}
              placeholder={t('Name')}
              onChange={e => updateWidgetTitle(e.target.value)}
            />
          </Wrapper>
        )}
        <Wrapper>
          {hasMultipleWidgets
            ? tct(
                'Adding [count] widgets to the selected dashboard. Any conflicting filters from these queries will be overridden by Dashboard filters.',
                {count: widgets.length}
              )
            : t(
                'Any conflicting filters from this query will be overridden by Dashboard filters. This is a preview of how the widget will appear in your dashboard.'
              )}
        </Wrapper>
        {!hasMultipleWidgets && (
          <MetricsCardinalityProvider organization={organization} location={location}>
            <MetricsDataSwitcher
              organization={organization}
              eventView={eventViewFromWidget(
                newWidgetTitle,
                widget.queries[0]!,
                selection
              )}
              location={location}
              hideLoadingIndicator
            >
              {metricsDataSide => (
                <DashboardsMEPProvider>
                  <MEPSettingProvider
                    location={location}
                    forceTransactions={metricsDataSide.forceTransactionsOnly}
                  >
                    <WidgetCardWrapper>
                      <WidgetCard
                        organization={organization}
                        isEditingDashboard={false}
                        showContextMenu={false}
                        widgetLimitReached={false}
                        selection={
                          selectedDashboard
                            ? getSavedFiltersAsPageFilters(selectedDashboard)
                            : selection
                        }
                        dashboardFilters={
                          getDashboardFiltersFromURL(location) ??
                          selectedDashboard?.filters
                        }
                        widget={{
                          ...widget,
                          title: newWidgetTitle,
                          tableWidths,
                          queries: getUpdatedWidgetQueries(),
                        }}
                        shouldResize
                        widgetLegendState={widgetLegendState}
                        onLegendSelectChanged={() => {}}
                        legendOptions={
                          widgetLegendState.widgetRequiresLegendUnselection(widget)
                            ? {selected: unselectedReleasesForCharts}
                            : undefined
                        }
                        disableFullscreen
                        onWidgetTableResizeColumn={handleWidgetTableColumnResize}
                        onWidgetTableSort={handleWidgetTableSort}
                        disableTableActions
                      />
                    </WidgetCardWrapper>
                    <IndexedEventsSelectionAlert widget={widget} />
                  </MEPSettingProvider>
                </DashboardsMEPProvider>
              )}
            </MetricsDataSwitcher>
          </MetricsCardinalityProvider>
        )}
      </Body>

      <Footer>
        <StyledButtonBar gap="lg">
          {actions.includes('add-and-stay-on-current-page') && (
            <Button
              onClick={handleAddAndStayOnCurrentPage}
              disabled={!canSubmit || selectedDashboardId === NEW_DASHBOARD_ID}
              title={canSubmit ? undefined : SELECT_DASHBOARD_MESSAGE}
            >
              {t('Add + Stay on this Page')}
            </Button>
          )}
          {actions.includes('add-and-open-dashboard') && (
            <Button
              priority={hasMultipleWidgets ? 'primary' : 'default'}
              onClick={handleAddAndOpenDashboard}
              disabled={!canSubmit}
              title={canSubmit ? undefined : SELECT_DASHBOARD_MESSAGE}
            >
              {t('Add + Open Dashboard')}
            </Button>
          )}
          {actions.includes('open-in-widget-builder') && !hasMultipleWidgets && (
            <Button
              priority="primary"
              onClick={() => goToDashboard('builder')}
              disabled={!canSubmit}
              title={canSubmit ? undefined : SELECT_DASHBOARD_MESSAGE}
            >
              {t('Open in Widget Builder')}
            </Button>
          )}
        </StyledButtonBar>
      </Footer>
    </Fragment>
  );
}

export default AddToDashboardModal;

const Wrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const StyledButtonBar = styled(ButtonBar)`
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    grid-template-rows: repeat(2, 1fr);
    gap: ${space(1.5)};
    width: 100%;

    > button {
      width: 100%;
    }
  }
`;

const WidgetCardWrapper = styled('div')`
  height: ${WIDGET_PREVIEW_HEIGHT};
`;

export const modalCss = css`
  max-width: 700px;
  margin: 70px auto;
`;
