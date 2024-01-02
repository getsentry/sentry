import {useEffect, useState} from 'react';
import {InjectedRouter} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Location, Query} from 'history';

import {
  fetchDashboard,
  fetchDashboards,
  updateDashboard,
} from 'sentry/actionCreators/dashboards';
import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DateString, Organization, PageFilters, SelectValue} from 'sentry/types';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import useApi from 'sentry/utils/useApi';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {
  DashboardDetails,
  DashboardListItem,
  DisplayType,
  MAX_WIDGETS,
  Widget,
} from 'sentry/views/dashboards/types';
import {
  eventViewFromWidget,
  getDashboardFiltersFromURL,
  getSavedFiltersAsPageFilters,
  getSavedPageFilters,
} from 'sentry/views/dashboards/utils';
import {NEW_DASHBOARD_ID} from 'sentry/views/dashboards/widgetBuilder/utils';
import WidgetCard from 'sentry/views/dashboards/widgetCard';
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
  end?: DateString;
  start?: DateString;
  statsPeriod?: string | null;
}>;

export type AddToDashboardModalProps = {
  location: Location;
  organization: Organization;
  router: InjectedRouter;
  selection: PageFilters;
  widget: Widget;
  widgetAsQueryParams: WidgetAsQueryParams;
};

type Props = ModalRenderProps & AddToDashboardModalProps;

const SELECT_DASHBOARD_MESSAGE = t('Select a dashboard');

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

  function handleGoToBuilder() {
    const pathname =
      selectedDashboardId === NEW_DASHBOARD_ID
        ? `/organizations/${organization.slug}/dashboards/new/widget/new/`
        : `/organizations/${organization.slug}/dashboard/${selectedDashboardId}/widget/new/`;

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

  async function handleAddAndStayOnCurrentPage() {
    if (selectedDashboard === null) {
      return;
    }

    let orderby = widget.queries[0].orderby;
    if (!(DisplayType.AREA && widget.queries[0].columns.length)) {
      orderby = ''; // Clear orderby if its not a top n visualization.
    }
    const query = widget.queries[0];

    const newWidget = {
      ...widget,
      title: widget.title === '' ? t('All Events') : widget.title,
      queries: [{...query, orderby}],
    };

    const newDashboard = {
      ...selectedDashboard,
      widgets: [...selectedDashboard.widgets, newWidget],
    };

    await updateDashboard(api, organization.slug, newDashboard);

    closeModal();
    addSuccessMessage(t('Successfully added widget to dashboard'));
  }

  const canSubmit = selectedDashboardId !== null;

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
            options={
              dashboards && [
                {label: t('+ Create New Dashboard'), value: 'new'},
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
              ]
            }
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
            eventView={eventViewFromWidget(widget.title, widget.queries[0], selection)}
            location={location}
            hideLoadingIndicator
          >
            {metricsDataSide => (
              <MEPSettingProvider
                location={location}
                forceTransactions={metricsDataSide.forceTransactionsOnly}
              >
                <WidgetCard
                  organization={organization}
                  isEditing={false}
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
                  showStoredAlert
                />
              </MEPSettingProvider>
            )}
          </MetricsDataSwitcher>
        </MetricsCardinalityProvider>
      </Body>

      <Footer>
        <StyledButtonBar gap={1.5}>
          <Button
            onClick={handleAddAndStayOnCurrentPage}
            disabled={!canSubmit || selectedDashboardId === NEW_DASHBOARD_ID}
            title={canSubmit ? undefined : SELECT_DASHBOARD_MESSAGE}
          >
            {t('Add + Stay on this Page')}
          </Button>
          <Button
            priority="primary"
            onClick={handleGoToBuilder}
            disabled={!canSubmit}
            title={canSubmit ? undefined : SELECT_DASHBOARD_MESSAGE}
          >
            {t('Open in Widget Builder')}
          </Button>
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
