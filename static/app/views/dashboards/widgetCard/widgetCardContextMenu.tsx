import type React from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {
  openAddToDashboardModal,
  openDashboardWidgetQuerySelectorModal,
} from 'sentry/actionCreators/modal';
import {openConfirmModal} from 'sentry/components/confirm';
import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {isWidgetViewerPath} from 'sentry/components/modals/widgetViewerModal/utils';
import {IconEllipsis, IconExpand, IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {
  MEPState,
  useMEPSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import useOrganization from 'sentry/utils/useOrganization';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {DashboardWidgetSource, WidgetType} from 'sentry/views/dashboards/types';
import {
  getWidgetDiscoverUrl,
  getWidgetIssueUrl,
  hasDatasetSelector,
  isUsingPerformanceScore,
  performanceScoreTooltip,
} from 'sentry/views/dashboards/utils';
import {
  getWidgetExploreUrl,
  getWidgetLogURL,
} from 'sentry/views/dashboards/utils/getWidgetExploreUrl';
import {WidgetViewerContext} from 'sentry/views/dashboards/widgetViewer/widgetViewerContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';

import {useDashboardsMEPContext} from './dashboardsMEPContext';

type Props = {
  dashboardFilters: DashboardFilters | undefined;
  location: Location;
  organization: Organization;
  router: InjectedRouter;
  selection: PageFilters;
  widget: Widget;
  widgetLimitReached: boolean;
  description?: string;
  hasEditAccess?: boolean;
  index?: string;
  isPreview?: boolean;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onEdit?: () => void;
  pageLinks?: string;
  seriesData?: Series[];
  seriesResultsType?: Record<string, AggregationOutputType>;
  showContextMenu?: boolean;
  tableData?: TableDataWithTitle[];
  title?: string | React.ReactNode;
  totalIssuesCount?: string;
};

export const useIndexedEventsWarning = (): string | null => {
  const {isMetricsData} = useDashboardsMEPContext();
  const organization = useOrganization();
  const metricSettingContext = useMEPSettingContext();

  return !organization.features.includes('performance-mep-bannerless-ui') &&
    isMetricsData === false &&
    metricSettingContext &&
    metricSettingContext.metricSettingState !== MEPState.TRANSACTIONS_ONLY
    ? t('Indexed')
    : null;
};

function WidgetCardContextMenu({
  organization,
  dashboardFilters,
  selection,
  widget,
  widgetLimitReached,
  hasEditAccess,
  onDelete,
  onDuplicate,
  onEdit,
  showContextMenu,
  isPreview,
  router,
  location,
  index,
  seriesData,
  tableData,
  pageLinks,
  totalIssuesCount,
  seriesResultsType,
  description,
  title,
}: Props) {
  const indexedEventsWarning = useIndexedEventsWarning();
  const {isMetricsData} = useDashboardsMEPContext();

  if (!showContextMenu) {
    return null;
  }

  const openWidgetViewerPath = (id: string | undefined) => {
    if (!isWidgetViewerPath(location.pathname)) {
      router.push({
        pathname: `${location.pathname}${
          location.pathname.endsWith('/') ? '' : '/'
        }widget/${id}/`,
        query: location.query,
      });
    }
  };

  if (isPreview) {
    return (
      <WidgetViewerContext.Consumer>
        {({setData}) => (
          <ContextWrapper>
            {indexedEventsWarning ? (
              <Tooltip title={indexedEventsWarning} skipWrapper>
                <SampledTag>{t('Indexed')}</SampledTag>
              </Tooltip>
            ) : null}
            {title && (
              <Tooltip
                title={
                  <span>
                    <WidgetTooltipTitle>{title}</WidgetTooltipTitle>
                    {description && (
                      <WidgetTooltipDescription>{description}</WidgetTooltipDescription>
                    )}
                  </span>
                }
                containerDisplayMode="grid"
                isHoverable
              >
                <WidgetTooltipButton
                  aria-label={t('Widget description')}
                  borderless
                  size="xs"
                  icon={<IconInfo />}
                />
              </Tooltip>
            )}
            <StyledDropdownMenuControl
              items={[
                {
                  key: 'preview',
                  label: t(
                    'This is a preview only. To edit, you must add this dashboard.'
                  ),
                  disabled: true,
                },
              ]}
              triggerProps={{
                'aria-label': t('Widget actions'),
                size: 'xs',
                borderless: true,
                showChevron: false,
                icon: <IconEllipsis direction="down" size="sm" />,
              }}
              position="bottom-end"
            />
            <Button
              aria-label={t('Open Widget Viewer')}
              borderless
              size="xs"
              icon={<IconExpand />}
              onClick={() => {
                if (seriesData || tableData) {
                  setData({
                    seriesData,
                    tableData,
                    pageLinks,
                    totalIssuesCount,
                    seriesResultsType,
                  });
                }
                openWidgetViewerPath(index);
              }}
            />
          </ContextWrapper>
        )}
      </WidgetViewerContext.Consumer>
    );
  }

  const menuOptions = getMenuOptions(
    dashboardFilters,
    organization,
    selection,
    widget,
    Boolean(isMetricsData),
    widgetLimitReached,
    hasEditAccess,
    location,
    router,
    onDelete,
    onDuplicate,
    onEdit
  );

  if (!menuOptions.length) {
    return null;
  }

  return (
    <WidgetViewerContext.Consumer>
      {({setData}) => (
        <ContextWrapper>
          {indexedEventsWarning ? (
            <Tooltip title={indexedEventsWarning} skipWrapper>
              <SampledTag>{t('Indexed')}</SampledTag>
            </Tooltip>
          ) : null}
          {title && (
            <Tooltip
              title={
                <span>
                  <WidgetTooltipTitle>{title}</WidgetTooltipTitle>
                  {description && (
                    <WidgetTooltipDescription>{description}</WidgetTooltipDescription>
                  )}
                </span>
              }
              containerDisplayMode="grid"
              isHoverable
            >
              <WidgetTooltipButton
                aria-label={t('Widget description')}
                borderless
                size="xs"
                icon={<IconInfo />}
              />
            </Tooltip>
          )}
          <StyledDropdownMenuControl
            items={menuOptions}
            triggerProps={{
              'aria-label': t('Widget actions'),
              size: 'xs',
              borderless: true,
              showChevron: false,
              icon: <IconEllipsis direction="down" size="sm" />,
            }}
            position="bottom-end"
          />
          <Button
            aria-label={t('Open Widget Viewer')}
            borderless
            size="xs"
            icon={<IconExpand />}
            onClick={() => {
              setData({
                seriesData,
                tableData,
                pageLinks,
                totalIssuesCount,
                seriesResultsType,
              });
              openWidgetViewerPath(widget.id ?? index);
            }}
          />
        </ContextWrapper>
      )}
    </WidgetViewerContext.Consumer>
  );
}

export function getMenuOptions(
  dashboardFilters: DashboardFilters | undefined,
  organization: Organization,
  selection: PageFilters,
  widget: Widget,
  isMetricsData: boolean,
  widgetLimitReached: boolean,
  hasEditAccess = true,
  location: Location,
  router: InjectedRouter,
  onDelete?: () => void,
  onDuplicate?: () => void,
  onEdit?: () => void
) {
  const menuOptions: MenuItemProps[] = [];

  const disableTransactionEdit =
    organization.features.includes('discover-saved-queries-deprecation') &&
    widget.widgetType === WidgetType.TRANSACTIONS;

  if (
    organization.features.includes('discover-basic') &&
    widget.widgetType &&
    [WidgetType.DISCOVER, WidgetType.ERRORS, WidgetType.TRANSACTIONS].includes(
      widget.widgetType
    )
  ) {
    const optionDisabled =
      (hasDatasetSelector(organization) && widget.widgetType === WidgetType.DISCOVER) ||
      isUsingPerformanceScore(widget);
    // Open Widget in Discover
    if (widget.queries.length) {
      const discoverPath = getWidgetDiscoverUrl(
        widget,
        dashboardFilters,
        selection,
        organization,
        0,
        isMetricsData
      );
      menuOptions.push({
        key: 'open-in-discover',
        label: t('Open in Discover'),
        to: optionDisabled
          ? undefined
          : widget.queries.length === 1
            ? discoverPath
            : undefined,
        tooltip: isUsingPerformanceScore(widget)
          ? performanceScoreTooltip
          : t(
              'We are splitting datasets to make them easier to digest. Please confirm the dataset for this widget by clicking Edit Widget.'
            ),
        tooltipOptions: {disabled: !optionDisabled},
        disabled: optionDisabled,
        showDetailsInOverlay: true,
        onAction: () => {
          if (widget.queries.length === 1) {
            trackAnalytics('dashboards_views.open_in_discover.opened', {
              organization,
              widget_type: widget.displayType,
            });
            return;
          }

          trackAnalytics('dashboards_views.query_selector.opened', {
            organization,
            widget_type: widget.displayType,
          });
          openDashboardWidgetQuerySelectorModal({
            organization,
            widget,
            isMetricsData,
            dashboardFilters,
          });
        },
      });
    }
  }

  if (widget.widgetType === WidgetType.SPANS) {
    menuOptions.push({
      key: 'open-in-explore',
      label: t('Open in Explore'),
      to: getWidgetExploreUrl(
        widget,
        dashboardFilters,
        selection,
        organization,
        Mode.SAMPLES
      ),
    });
  }

  if (widget.widgetType === WidgetType.LOGS) {
    menuOptions.push({
      key: 'open-in-explore',
      label: t('Open in Explore'),
      to: getWidgetLogURL(widget, dashboardFilters, selection, organization),
    });
  }

  if (widget.widgetType === WidgetType.ISSUE) {
    const issuesLocation = getWidgetIssueUrl(
      widget,
      dashboardFilters,
      selection,
      organization
    );

    menuOptions.push({
      key: 'open-in-issues',
      label: t('Open in Issues'),
      to: issuesLocation,
    });
  }

  if (organization.features.includes('dashboards-edit')) {
    menuOptions.push({
      key: 'add-to-dashboard',
      label: t('Add to Dashboard'),
      onAction: () => {
        openAddToDashboardModal({
          organization,
          location,
          router,
          selection,
          widget: {
            ...widget,
            id: undefined,
            dashboardId: undefined,
            layout: undefined,
          },
          actions: ['add-and-stay-on-current-page', 'open-in-widget-builder'],
          allowCreateNewDashboard: true,
          source: DashboardWidgetSource.DASHBOARDS,
        });
      },
    });
    menuOptions.push({
      key: 'duplicate-widget',
      label: t('Duplicate Widget'),
      onAction: () => onDuplicate?.(),
      tooltip: disableTransactionEdit
        ? t('This dataset is is no longer supported. Please use the Spans dataset.')
        : undefined,
      disabled: widgetLimitReached || !hasEditAccess || disableTransactionEdit,
    });

    menuOptions.push({
      key: 'edit-widget',
      label: t('Edit Widget'),
      onAction: () => onEdit?.(),
      disabled: !hasEditAccess,
    });

    menuOptions.push({
      key: 'delete-widget',
      label: t('Delete Widget'),
      priority: 'danger',
      onAction: () => {
        openConfirmModal({
          message: t('Are you sure you want to delete this widget?'),
          priority: 'danger',
          onConfirm: () => onDelete?.(),
        });
      },
      disabled: !hasEditAccess,
    });
  }

  return menuOptions;
}

export default WidgetCardContextMenu;

const ContextWrapper = styled('div')`
  display: flex;
  align-items: center;
  height: ${space(3)};
  margin-left: ${space(1)};
  gap: ${space(0.25)};
`;

const StyledDropdownMenuControl = styled(DropdownMenu)`
  display: flex;
  & > button {
    z-index: auto;
  }
`;

const SampledTag = styled(Tag)`
  margin-right: ${space(0.5)};
`;

const WidgetTooltipTitle = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSize.md};
  text-align: left;
`;

const WidgetTooltipDescription = styled('div')`
  margin-top: ${space(0.5)};
  font-size: ${p => p.theme.fontSize.sm};
  text-align: left;
`;

// We're using a button here to preserve tab accessibility
const WidgetTooltipButton = styled(Button)`
  pointer-events: none;
`;
