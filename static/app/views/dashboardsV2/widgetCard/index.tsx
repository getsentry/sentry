import React, {Component} from 'react';
import LazyLoad from 'react-lazyload';
// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';
import {useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import {HeaderTitle} from 'sentry/components/charts/styles';
import DateTime from 'sentry/components/dateTime';
import ErrorBoundary from 'sentry/components/errorBoundary';
import ExternalLink from 'sentry/components/links/externalLink';
import {Panel} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {parseSearch} from 'sentry/components/searchSyntax/parser';
import Tooltip from 'sentry/components/tooltip';
import {IconCopy, IconDelete, IconEdit, IconGrabbable} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {statsPeriodToDays} from 'sentry/utils/dates';
import {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {parseFunction} from 'sentry/utils/discover/fields';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';

import {DRAG_HANDLE_CLASS} from '../dashboard';
import {DashboardFilters, DisplayType, Widget, WidgetType} from '../types';
import {isCustomMeasurementWidget} from '../utils';
import {DEFAULT_RESULTS_LIMIT} from '../widgetBuilder/utils';

import {DashboardsMEPConsumer, DashboardsMEPProvider} from './dashboardsMEPContext';
import WidgetCardChartContainer from './widgetCardChartContainer';
import WidgetCardContextMenu from './widgetCardContextMenu';

type DraggableProps = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>;

type Props = WithRouterProps & {
  api: Client;
  currentWidgetDragging: boolean;
  isEditing: boolean;
  isSorting: boolean;
  location: Location;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  widgetLimitReached: boolean;
  dashboardFilters?: DashboardFilters;
  draggableProps?: DraggableProps;
  hasUnsavedFilters?: boolean;
  hideToolbar?: boolean;
  index?: string;
  isMobile?: boolean;
  isPreview?: boolean;
  noDashboardsMEPProvider?: boolean;
  noLazyLoad?: boolean;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onEdit?: () => void;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
  showContextMenu?: boolean;
  showStoredAlert?: boolean;
  showWidgetViewerButton?: boolean;
  tableItemLimit?: number;
  windowWidth?: number;
};

type State = {
  pageLinks?: string;
  seriesData?: Series[];
  tableData?: TableDataWithTitle[];
  totalIssuesCount?: string;
};

type SearchFilterKey = {key?: {value: string}};

const METRICS_BACKED_SESSIONS_START_DATE = new Date('2022-04-12');

const ERROR_FIELDS = [
  'error.handled',
  'error.unhandled',
  'error.mechanism',
  'error.type',
  'error.value',
];

class WidgetCard extends Component<Props, State> {
  state: State = {};
  renderToolbar() {
    const {
      onEdit,
      onDelete,
      onDuplicate,
      draggableProps,
      hideToolbar,
      isEditing,
      isMobile,
    } = this.props;

    if (!isEditing) {
      return null;
    }

    return (
      <ToolbarPanel>
        <IconContainer style={{visibility: hideToolbar ? 'hidden' : 'visible'}}>
          {!isMobile && (
            <GrabbableButton
              size="xs"
              aria-label={t('Drag Widget')}
              icon={<IconGrabbable />}
              borderless
              className={DRAG_HANDLE_CLASS}
              {...draggableProps?.listeners}
              {...draggableProps?.attributes}
            />
          )}
          <Button
            data-test-id="widget-edit"
            aria-label={t('Edit Widget')}
            size="xs"
            borderless
            onClick={onEdit}
            icon={<IconEdit />}
          />
          <Button
            aria-label={t('Duplicate Widget')}
            size="xs"
            borderless
            onClick={onDuplicate}
            icon={<IconCopy />}
          />
          <Button
            data-test-id="widget-delete"
            aria-label={t('Delete Widget')}
            borderless
            size="xs"
            onClick={onDelete}
            icon={<IconDelete />}
          />
        </IconContainer>
      </ToolbarPanel>
    );
  }

  renderContextMenu() {
    const {
      widget,
      selection,
      organization,
      showContextMenu,
      isPreview,
      widgetLimitReached,
      onEdit,
      onDuplicate,
      onDelete,
      isEditing,
      showWidgetViewerButton,
      router,
      location,
      index,
      hasUnsavedFilters,
    } = this.props;

    const {seriesData, tableData, pageLinks, totalIssuesCount} = this.state;

    if (isEditing) {
      return null;
    }

    return (
      <WidgetCardContextMenu
        organization={organization}
        widget={widget}
        selection={selection}
        showContextMenu={showContextMenu}
        isPreview={isPreview}
        widgetLimitReached={widgetLimitReached}
        onDuplicate={onDuplicate}
        onEdit={onEdit}
        onDelete={onDelete}
        showWidgetViewerButton={showWidgetViewerButton}
        router={router}
        location={location}
        index={index}
        seriesData={seriesData}
        tableData={tableData}
        pageLinks={pageLinks}
        totalIssuesCount={totalIssuesCount}
        hasUnsavedFilters={hasUnsavedFilters}
      />
    );
  }

  setData = ({
    tableResults,
    timeseriesResults,
    totalIssuesCount,
    pageLinks,
  }: {
    pageLinks?: string;
    tableResults?: TableDataWithTitle[];
    timeseriesResults?: Series[];
    totalIssuesCount?: string;
  }) => {
    this.setState({
      seriesData: timeseriesResults,
      tableData: tableResults,
      totalIssuesCount,
      pageLinks,
    });
  };

  render() {
    const {
      api,
      organization,
      selection,
      widget,
      isMobile,
      renderErrorMessage,
      tableItemLimit,
      windowWidth,
      noLazyLoad,
      showStoredAlert,
      noDashboardsMEPProvider,
      dashboardFilters,
    } = this.props;

    const {start, period} = selection.datetime;
    let showIncompleteDataAlert: boolean = false;
    if (widget.widgetType === WidgetType.RELEASE && showStoredAlert) {
      if (start) {
        let startDate: Date | undefined = undefined;
        if (typeof start === 'string') {
          startDate = new Date(start);
        } else {
          startDate = start;
        }
        showIncompleteDataAlert = startDate < METRICS_BACKED_SESSIONS_START_DATE;
      } else if (period) {
        const periodInDays = statsPeriodToDays(period);
        const current = new Date();
        const prior = new Date(new Date().setDate(current.getDate() - periodInDays));
        showIncompleteDataAlert = prior < METRICS_BACKED_SESSIONS_START_DATE;
      }
    }
    if (widget.displayType === DisplayType.TOP_N) {
      const queries = widget.queries.map(query => ({
        ...query,
        // Use the last aggregate because that's where the y-axis is stored
        aggregates: query.aggregates.length
          ? [query.aggregates[query.aggregates.length - 1]]
          : [],
      }));
      widget.queries = queries;
      widget.limit = DEFAULT_RESULTS_LIMIT;
    }

    function conditionalWrapWithDashboardsMEPProvider(component: React.ReactNode) {
      if (noDashboardsMEPProvider) {
        return component;
      }
      return <DashboardsMEPProvider>{component}</DashboardsMEPProvider>;
    }
    const widgetContainsErrorFields = widget.queries.some(
      ({columns, aggregates, conditions}) =>
        ERROR_FIELDS.some(
          errorField =>
            columns.includes(errorField) ||
            aggregates.some(aggregate =>
              parseFunction(aggregate)?.arguments.includes(errorField)
            ) ||
            parseSearch(conditions)?.some(
              filter => (filter as SearchFilterKey).key?.value === errorField
            )
        )
    );
    return (
      <ErrorBoundary
        customComponent={<ErrorCard>{t('Error loading widget data')}</ErrorCard>}
      >
        {conditionalWrapWithDashboardsMEPProvider(
          <React.Fragment>
            <WidgetCardPanel isDragging={false}>
              <WidgetHeader>
                <Tooltip
                  title={widget.title}
                  containerDisplayMode="grid"
                  showOnlyOnOverflow
                >
                  <WidgetTitle>{widget.title}</WidgetTitle>
                </Tooltip>
                {this.renderContextMenu()}
              </WidgetHeader>
              {noLazyLoad ? (
                <WidgetCardChartContainer
                  api={api}
                  organization={organization}
                  selection={selection}
                  widget={widget}
                  isMobile={isMobile}
                  renderErrorMessage={renderErrorMessage}
                  tableItemLimit={tableItemLimit}
                  windowWidth={windowWidth}
                  onDataFetched={this.setData}
                  dashboardFilters={dashboardFilters}
                />
              ) : (
                <LazyLoad once resize height={200}>
                  <WidgetCardChartContainer
                    api={api}
                    organization={organization}
                    selection={selection}
                    widget={widget}
                    isMobile={isMobile}
                    renderErrorMessage={renderErrorMessage}
                    tableItemLimit={tableItemLimit}
                    windowWidth={windowWidth}
                    onDataFetched={this.setData}
                    dashboardFilters={dashboardFilters}
                  />
                </LazyLoad>
              )}
              {this.renderToolbar()}
            </WidgetCardPanel>
            <Feature organization={organization} features={['dashboards-mep']}>
              <DashboardsMEPConsumer>
                {({isMetricsData}) => {
                  if (
                    showStoredAlert &&
                    isMetricsData === false &&
                    widget.widgetType === WidgetType.DISCOVER
                  ) {
                    if (isCustomMeasurementWidget(widget)) {
                      return (
                        <StoredDataAlert showIcon type="error">
                          {tct(
                            'You have inputs that are incompatible with [customPerformanceMetrics: custom performance metrics]. See all compatible fields and functions [here: here]. Update your inputs or remove any custom performance metrics.',
                            {
                              customPerformanceMetrics: (
                                <ExternalLink href="https://docs.sentry.io/" />
                              ), // TODO(dashboards): Update the docs URL
                              here: <ExternalLink href="https://docs.sentry.io/" />, // TODO(dashboards): Update the docs URL
                            }
                          )}
                        </StoredDataAlert>
                      );
                    }
                    if (!widgetContainsErrorFields) {
                      return (
                        <StoredDataAlert showIcon>
                          {tct(
                            "Your selection is only applicable to [storedData: stored event data]. We've automatically adjusted your results.",
                            {
                              storedData: <ExternalLink href="https://docs.sentry.io/" />, // TODO(dashboards): Update the docs URL
                            }
                          )}
                        </StoredDataAlert>
                      );
                    }
                  }
                  return null;
                }}
              </DashboardsMEPConsumer>
            </Feature>
            <Feature organization={organization} features={['dashboards-releases']}>
              {showIncompleteDataAlert && (
                <StoredDataAlert showIcon>
                  {tct(
                    'Releases data is only available from [date]. Data may be incomplete as a result.',
                    {
                      date: (
                        <DateTime date={METRICS_BACKED_SESSIONS_START_DATE} dateOnly />
                      ),
                    }
                  )}
                </StoredDataAlert>
              )}
            </Feature>
          </React.Fragment>
        )}
      </ErrorBoundary>
    );
  }
}

export default withApi(withOrganization(withPageFilters(withRouter(WidgetCard))));

const ErrorCard = styled(Placeholder)`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${p => p.theme.alert.error.backgroundLight};
  border: 1px solid ${p => p.theme.alert.error.border};
  color: ${p => p.theme.alert.error.textLight};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(2)};
`;

export const WidgetCardPanel = styled(Panel, {
  shouldForwardProp: prop => prop !== 'isDragging',
})<{
  isDragging: boolean;
}>`
  margin: 0;
  visibility: ${p => (p.isDragging ? 'hidden' : 'visible')};
  /* If a panel overflows due to a long title stretch its grid sibling */
  height: 100%;
  min-height: 96px;
  display: flex;
  flex-direction: column;
`;

const ToolbarPanel = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;

  width: 100%;
  height: 100%;

  display: flex;
  justify-content: flex-end;
  align-items: flex-start;

  background-color: ${p => p.theme.overlayBackgroundAlpha};
  border-radius: ${p => p.theme.borderRadius};
`;

const IconContainer = styled('div')`
  display: flex;
  margin: ${space(1)};
  touch-action: none;
`;

const GrabbableButton = styled(Button)`
  cursor: grab;
`;

const WidgetTitle = styled(HeaderTitle)`
  ${p => p.theme.overflowEllipsis};
  font-weight: normal;
`;

const WidgetHeader = styled('div')`
  padding: ${space(2)} ${space(1)} 0 ${space(3)};
  min-height: 36px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const StoredDataAlert = styled(Alert)`
  margin-top: ${space(1)};
  margin-bottom: 0;
`;
