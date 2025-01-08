import {useEffect, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location, Query} from 'history';

import {
  fetchDashboard,
  fetchDashboards,
  updateDashboard,
} from 'sentry/actionCreators/dashboards';
import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DateString, PageFilters, SelectValue} from 'sentry/types/core';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {IndexedEventsSelectionAlert} from 'sentry/views/dashboards/indexedEventsSelectionAlert';
import type {
  DashboardDetails,
  DashboardListItem,
  Widget,
} from 'sentry/views/dashboards/types';
import {DisplayType, MAX_WIDGETS, WidgetType} from 'sentry/views/dashboards/types';
import {
  eventViewFromWidget,
  getDashboardFiltersFromURL,
  getSavedFiltersAsPageFilters,
  getSavedPageFilters,
} from 'sentry/views/dashboards/utils';
import {
  type DataSet,
  NEW_DASHBOARD_ID,
} from 'sentry/views/dashboards/widgetBuilder/utils';
import WidgetCard from 'sentry/views/dashboards/widgetCard';
import {DashboardsMEPProvider} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import WidgetLegendNameEncoderDecoder from 'sentry/views/dashboards/widgetLegendNameEncoderDecoder';
import WidgetLegendSelectionState from 'sentry/views/dashboards/widgetLegendSelectionState';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {MetricsDataSwitcher} from 'sentry/views/performance/landing/metricsDataSwitcher';

type WidgetAsQueryParams = Query<{
  defaultTableColumns: string[];
  defaultTitle: string;
  defaultWidgetQuery: string;
  displayType: DisplayType;
  environment: string[];
  project: number[];
  source: string;
  dataset?: DataSet;
  end?: DateString;
  start?: DateString;
  statsPeriod?: string | null;
}>;

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
  widgetAsQueryParams: WidgetAsQueryParams;
  actions?: AddToDashboardModalActions[];
  allowCreateNewDashboard?: boolean;
};

type Props = ModalRenderProps & AddToDashboardModalProps;

const SELECT_DASHBOARD_MESSAGE = t('Select a dashboard');

const DEFAULT_ACTIONS: AddToDashboardModalActions[] = [
  'add-and-stay-on-current-page',
  'open-in-widget-builder',
];

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
  widgetAsQueryParams,
  actions = DEFAULT_ACTIONS,
  allowCreateNewDashboard = true,
}: Props) {
  const api = useApi();
  const [dashboards, setDashboards] = useState<DashboardListItem[] | null>(null);
  const [selectedDashboard, setSelectedDashboard] = useState<DashboardDetails | null>(
    null
  );
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);

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

    const builderSuffix = organization.features.includes(
      'dashboards-widget-builder-redesign'
    )
      ? 'widget-builder/widget/new/'
      : 'widget/new/';

    const pathname =
      page === 'builder' ? `${dashboardsPath}${builderSuffix}` : dashboardsPath;

    router.push(
      normalizeUrl({
        pathname,
        query: {
          ...widgetAsQueryParams,
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

    let orderby = widget.queries[0]!.orderby;
    if (!(DisplayType.AREA && widget.queries[0]!.columns.length)) {
      orderby = ''; // Clear orderby if its not a top n visualization.
    }
    const query = widget.queries[0]!;

    const title =
      // Metric widgets have their default title derived from the query
      widget.title === '' && widget.widgetType !== WidgetType.METRICS
        ? t('All Events')
        : widget.title;

    const newWidget = {
      ...widget,
      title,
      queries: [{...query, orderby}],
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

  const options = useMemo(() => {
    if (dashboards === null) {
      return null;
    }

    return [
      allowCreateNewDashboard && {
        label: t('+ Create New Dashboard'),
        value: 'new',
      },
      ...dashboards.map(({title, id, widgetDisplay}) => ({
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
    ].filter(Boolean) as SelectValue<string>[];
  }, [allowCreateNewDashboard, dashboards]);

  const widgetLegendState = new WidgetLegendSelectionState({
    location,
    router,
    organization,
    dashboard: selectedDashboard,
  });

  const unselectedReleasesForCharts = {
    [WidgetLegendNameEncoderDecoder.encodeSeriesNameForLegend('Releases', widget.id)]:
      false,
  };

  return (
    <OrganizationContext.Provider value={organization}>
      <Header closeButton>
        <h4>{t('Add to Dashboard')}</h4>
      </Header>
      <Body>
        <Wrapper>
          <SelectControl
            disabled={dashboards === null}
            menuPlacement="auto"
            name="dashboard"
            placeholder={t('Select Dashboard')}
            value={selectedDashboardId}
            options={options}
            onChange={(option: SelectValue<string>) => {
              if (option.disabled) {
                return;
              }
              setSelectedDashboardId(option.value);
            }}
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
            eventView={eventViewFromWidget(widget.title, widget.queries[0]!, selection)}
            location={location}
            hideLoadingIndicator
          >
            {metricsDataSide => (
              <DashboardsMEPProvider>
                <MEPSettingProvider
                  location={location}
                  forceTransactions={metricsDataSide.forceTransactionsOnly}
                >
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
                    widget={widget}
                    shouldResize={false}
                    widgetLegendState={widgetLegendState}
                    onLegendSelectChanged={() => {}}
                    legendOptions={
                      widgetLegendState.widgetRequiresLegendUnselection(widget)
                        ? {selected: unselectedReleasesForCharts}
                        : undefined
                    }
                    disableFullscreen
                  />

                  <IndexedEventsSelectionAlert widget={widget} />
                </MEPSettingProvider>
              </DashboardsMEPProvider>
            )}
          </MetricsDataSwitcher>
        </MetricsCardinalityProvider>
      </Body>

      <Footer>
        <StyledButtonBar gap={1.5}>
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
    </OrganizationContext.Provider>
  );
}

export default AddToDashboardModal;

const Wrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const StyledButtonBar = styled(ButtonBar)`
  @media (max-width: ${props => props.theme.breakpoints.small}) {
    grid-template-rows: repeat(2, 1fr);
    gap: ${space(1.5)};
    width: 100%;

    > button {
      width: 100%;
    }
  }
`;

export const modalCss = css`
  max-width: 700px;
  margin: 70px auto;
`;
