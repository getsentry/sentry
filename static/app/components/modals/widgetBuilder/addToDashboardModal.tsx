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
import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Input} from 'sentry/components/core/input';
import {Select} from 'sentry/components/core/select';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters, SelectValue} from 'sentry/types/core';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Sort} from 'sentry/utils/discover/fields';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import {DashboardCreateLimitWrapper} from 'sentry/views/dashboards/createLimitWrapper';
import {IndexedEventsSelectionAlert} from 'sentry/views/dashboards/indexedEventsSelectionAlert';
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

type AddToDashboardModalActions =
  | 'add-and-open-dashboard'
  | 'add-and-stay-on-current-page'
  | 'open-in-widget-builder';

export type AddToDashboardModalProps = {
  location: Location;
  organization: Organization;
  router: InjectedRouter;
  selection: PageFilters;
  widget: Widget;
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
  router,
  selection,
  widget,
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
  const [newWidgetTitle, setNewWidgetTitle] = useState<string>(
    getFallbackWidgetTitle(widget)
  );
  const [orderBy, setOrderBy] = useState<string>();
  const [tableWidths, setTableWidths] = useState<number[]>();

  const {dashboardId: currentDashboardId} = useParams<{dashboardId: string}>();

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

  function goToDashboard(page: 'builder' | 'preview') {
    const dashboardsPath =
      selectedDashboardId === NEW_DASHBOARD_ID
        ? `/organizations/${organization.slug}/dashboards/new/`
        : `/organizations/${organization.slug}/dashboard/${selectedDashboardId}/`;

    const builderSuffix = 'widget-builder/widget/new/';

    const pathname =
      page === 'builder' ? `${dashboardsPath}${builderSuffix}` : dashboardsPath;

    const widgetAsQueryParams = convertWidgetToBuilderStateParams(widget);

    router.push(
      normalizeUrl({
        pathname,
        query: {
          ...widgetAsQueryParams,
          title: newWidgetTitle,
          sort: orderBy ?? widgetAsQueryParams.sort,
          source,
          ...(selectedDashboard ? getSavedPageFilters(selectedDashboard) : {}),
        },
      })
    );
    closeModal();
  }

  async function handleAddWidget() {
    if (selectedDashboard === null) {
      return;
    }

    let newOrderBy = orderBy ?? widget.queries[0]!.orderby;
    if (!(DisplayType.AREA && widget.queries[0]!.columns.length)) {
      newOrderBy = ''; // Clear orderby if its not a top n visualization.
    }
    const queries = widget.queries.map(query => ({
      ...query,
      orderby: newOrderBy,
    }));

    const newWidget = {
      ...widget,
      title: newWidgetTitle,
      queries,
    };

    const newDashboard = {
      ...selectedDashboard,
      widgets: [...selectedDashboard.widgets, newWidget],
    };

    await updateDashboard(api, organization.slug, newDashboard);
  }

  async function handleAddAndStayOnCurrentPage() {
    await handleAddWidget();

    closeModal();
    addSuccessMessage(t('Successfully added widget to dashboard'));
  }

  async function handleAddAndOpenDashboard() {
    await handleAddWidget();

    goToDashboard('preview');
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
          tooltipOptions: {position: 'right'},
        },
        ...dashboards
          .filter(dashboard =>
            // if adding from a dashboard, currentDashboardId will be set and we'll remove it from the list of options
            currentDashboardId ? dashboard.id !== currentDashboardId : true
          )
          .map(({title, id, widgetDisplay}) => ({
            label: title,
            value: id,
            disabled: widgetDisplay.length >= MAX_WIDGETS,
            tooltip:
              widgetDisplay.length >= MAX_WIDGETS &&
              tct('Max widgets ([maxWidgets]) per dashboard reached.', {
                maxWidgets: MAX_WIDGETS,
              }),
            tooltipOptions: {position: 'right'},
          })),
      ].filter(Boolean) as Array<SelectValue<string>>;
    },
    [currentDashboardId, dashboards]
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
                menuPlacement="auto"
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
        <Wrapper>
          <SectionHeader title={t('Widget Name')} optional />
          <Input
            type="text"
            aria-label={t('Optional Widget Name')}
            placeholder={t('Name')}
            onChange={e => updateWidgetTitle(e.target.value)}
          />
        </Wrapper>
        <Wrapper>
          {t(
            'Any conflicting filters from this query will be overridden by Dashboard filters. This is a preview of how the widget will appear in your dashboard.'
          )}
        </Wrapper>
        <MetricsCardinalityProvider organization={organization} location={location}>
          <MetricsDataSwitcher
            organization={organization}
            eventView={eventViewFromWidget(newWidgetTitle, widget.queries[0]!, selection)}
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
                        getDashboardFiltersFromURL(location) ?? selectedDashboard?.filters
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
              onClick={handleAddAndOpenDashboard}
              disabled={!canSubmit}
              title={canSubmit ? undefined : SELECT_DASHBOARD_MESSAGE}
            >
              {t('Add + Open Dashboard')}
            </Button>
          )}
          {actions.includes('open-in-widget-builder') && (
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
