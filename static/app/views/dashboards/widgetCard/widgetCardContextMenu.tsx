import {useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import qs from 'query-string';

import {
  openAddToDashboardModal,
  openDashboardWidgetQuerySelectorModal,
} from 'sentry/actionCreators/modal';
import {openConfirmModal} from 'sentry/components/confirm';
import {Link} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {t, tct} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isEquation, stripEquationPrefix} from 'sentry/utils/discover/fields';
import {
  MEPState,
  useMEPSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {safeURL} from 'sentry/utils/url/safeURL';
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
import {getWidgetExploreUrl} from 'sentry/views/dashboards/utils/getWidgetExploreUrl';
import {getWidgetMetricsUrl} from 'sentry/views/dashboards/utils/getWidgetMetricsUrl';
import {getReferrer} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';

import {useDashboardsMEPContext} from './dashboardsMEPContext';

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

export const useTransactionsDeprecationWarning = ({
  widget,
  selection,
}: {
  selection: PageFilters;
  widget: Widget;
}): React.JSX.Element | null => {
  const organization = useOrganization();

  // memoize the URL to avoid recalculating it on every render
  const exploreUrl = useMemo(() => {
    if (
      !organization.features.includes('transaction-widget-deprecation-explore-view') ||
      widget.widgetType !== WidgetType.TRANSACTIONS ||
      !widget.exploreUrls ||
      widget.exploreUrls.length === 0
    ) {
      return null;
    }
    return createExploreUrl(widget.exploreUrls[0]!, selection, organization);
  }, [organization, widget.widgetType, widget.exploreUrls, selection]);

  if (!exploreUrl) {
    return null;
  }

  return tct(
    'Transaction based widgets will soon be migrated to spans widgets. To see what your query could look like, open it in [explore:Explore].',
    {
      explore: <Link to={exploreUrl} />,
    }
  );
};

const createExploreUrl = (
  baseUrl: string,
  selection: PageFilters,
  organization: Organization
): string => {
  const parsedUrl = safeURL(baseUrl);
  const queryParams = qs.parse(parsedUrl?.search ?? '');

  if (queryParams.aggregateField) {
    // we need to parse the aggregateField because it comes in stringified but needs to be passed in JSON format
    if (typeof queryParams.aggregateField === 'string') {
      queryParams.aggregateField = JSON.parse(queryParams.aggregateField);
    } else if (Array.isArray(queryParams.aggregateField)) {
      queryParams.aggregateField = queryParams.aggregateField.map(item =>
        JSON.parse(item)
      );
    }
  }
  return getExploreUrl({organization, selection, ...queryParams});
};

export const useDroppedColumnsWarning = (widget: Widget): React.JSX.Element | null => {
  if (!widget.changedReason) {
    return null;
  }

  const columnsDropped = [];
  const equationsDropped = [];
  const orderbyDropped = [];
  for (const changedReason of widget.changedReason) {
    if (changedReason.selected_columns.length > 0) {
      columnsDropped.push(...changedReason.selected_columns);
    }
    if (changedReason.equations) {
      equationsDropped.push(
        ...changedReason.equations.map(equation => equation.equation)
      );
    }
    if (changedReason.orderby) {
      orderbyDropped.push(
        ...changedReason.orderby.flatMap(orderby =>
          typeof orderby.reason === 'string' ? orderby.orderby : orderby.reason
        )
      );
    }
  }

  const orderbyDroppedWithoutNegation = orderbyDropped.map(orderby =>
    orderby.startsWith('-') ? orderby.replace('-', '') : orderby
  );
  const equationsDroppedParsed = equationsDropped.map(equation => {
    if (isEquation(equation)) {
      return stripEquationPrefix(equation);
    }
    return equation;
  });
  const combinedWarnings = [
    ...columnsDropped,
    ...equationsDroppedParsed,
    ...orderbyDroppedWithoutNegation,
  ];
  const allWarningsSet = new Set(combinedWarnings);
  const allWarnings = [...allWarningsSet];

  if (allWarnings.length > 0) {
    return (
      <div>
        <StyledText as="p">
          {tct(
            'This widget looks different because it was migrated to the spans dataset and [columns] is not supported.',
            {
              columns: allWarnings.join(', '),
            }
          )}
        </StyledText>
      </div>
    );
  }

  return null;
};

const StyledText = styled(Text)`
  padding-bottom: ${p => p.theme.space.xs};
`;

export function getMenuOptions(
  dashboardFilters: DashboardFilters | undefined,
  organization: Organization,
  selection: PageFilters,
  widget: Widget,
  isMetricsData: boolean,
  widgetLimitReached: boolean,
  hasEditAccess = true,
  location: Location,
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
        tooltip: isUsingPerformanceScore(widget) ? performanceScoreTooltip : null,
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

  if (widget.widgetType === WidgetType.SPANS || widget.widgetType === WidgetType.LOGS) {
    menuOptions.push({
      key: 'open-in-explore',
      label: t('Open in Explore'),
      to: getWidgetExploreUrl(
        widget,
        dashboardFilters,
        selection,
        organization,
        Mode.SAMPLES,
        getReferrer(widget.displayType)
      ),
    });
  }

  if (widget.widgetType === WidgetType.TRACEMETRICS) {
    menuOptions.push({
      key: 'open-in-metrics',
      label: t('Open in Explore'),
      to: getWidgetMetricsUrl(widget, dashboardFilters, selection, organization),
      onAction: () => {
        trackAnalytics('dashboards_views.open_in_metrics.opened', {
          organization,
          widget_type: widget.displayType,
        });
      },
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
      disabled: disableTransactionEdit,
      tooltip: disableTransactionEdit
        ? t('This dataset is no longer supported. Please use the Spans dataset.')
        : undefined,
      onAction: () => {
        openAddToDashboardModal({
          organization,
          location,
          selection,
          widget: {
            ...widget,
            id: undefined,
            dashboardId: undefined,
            layout: undefined,
          },
          actions: ['add-and-stay-on-current-page', 'open-in-widget-builder'],
          source: DashboardWidgetSource.DASHBOARDS,
        });
      },
    });
    menuOptions.push({
      key: 'duplicate-widget',
      label: t('Duplicate Widget'),
      onAction: () => onDuplicate?.(),
      tooltip: disableTransactionEdit
        ? t('This dataset is no longer supported. Please use the Spans dataset.')
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
