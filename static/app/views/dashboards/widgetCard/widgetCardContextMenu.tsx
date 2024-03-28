import type {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {openDashboardWidgetQuerySelectorModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {isWidgetViewerPath} from 'sentry/components/modals/widgetViewerModal/utils';
import {Tag} from 'sentry/components/tag';
import {IconEdit, IconEllipsis, IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, PageFilters} from 'sentry/types';
import type {Series} from 'sentry/types/echarts';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {hasMetricsExperimentalFeature} from 'sentry/utils/metrics/features';
import {
  MEPConsumer,
  MEPState,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {
  getWidgetDiscoverUrl,
  getWidgetIssueUrl,
  getWidgetMetricsUrl,
} from 'sentry/views/dashboards/utils';

import type {Widget} from '../types';
import {WidgetType} from '../types';
import {WidgetViewerContext} from '../widgetViewer/widgetViewerContext';

import {useDashboardsMEPContext} from './dashboardsMEPContext';

type Props = {
  location: Location;
  organization: Organization;
  router: InjectedRouter;
  selection: PageFilters;
  widget: Widget;
  widgetLimitReached: boolean;
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
  totalIssuesCount?: string;
};

function WidgetCardContextMenu({
  organization,
  selection,
  widget,
  widgetLimitReached,
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
}: Props) {
  const {isMetricsData} = useDashboardsMEPContext();
  if (!showContextMenu) {
    return null;
  }

  const menuOptions: MenuItemProps[] = [];
  const disabledKeys: string[] = [];

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

  const openWidgetViewerIcon =
    hasMetricsExperimentalFeature(organization) &&
    widget.widgetType === WidgetType.METRICS ? (
      <IconEdit />
    ) : (
      <IconExpand />
    );

  if (isPreview) {
    return (
      <WidgetViewerContext.Consumer>
        {({setData}) => (
          <MEPConsumer>
            {metricSettingContext => (
              <ContextWrapper>
                {!organization.features.includes('performance-mep-bannerless-ui') &&
                  isMetricsData === false &&
                  metricSettingContext &&
                  metricSettingContext.metricSettingState !==
                    MEPState.TRANSACTIONS_ONLY && (
                    <SampledTag
                      tooltipText={t('This widget is only applicable to indexed events.')}
                    >
                      {t('Indexed')}
                    </SampledTag>
                  )}
                <StyledDropdownMenuControl
                  items={[
                    {
                      key: 'preview',
                      label: t(
                        'This is a preview only. To edit, you must add this dashboard.'
                      ),
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
                  disabledKeys={[...disabledKeys, 'preview']}
                />
                <Button
                  aria-label={t('Open Widget Viewer')}
                  borderless
                  size="xs"
                  icon={openWidgetViewerIcon}
                  onClick={() => {
                    (seriesData || tableData) &&
                      setData({
                        seriesData,
                        tableData,
                        pageLinks,
                        totalIssuesCount,
                        seriesResultsType,
                      });
                    openWidgetViewerPath(index);
                  }}
                />
              </ContextWrapper>
            )}
          </MEPConsumer>
        )}
      </WidgetViewerContext.Consumer>
    );
  }

  if (
    organization.features.includes('discover-basic') &&
    widget.widgetType === WidgetType.DISCOVER
  ) {
    // Open Widget in Discover
    if (widget.queries.length) {
      const discoverPath = getWidgetDiscoverUrl(
        widget,
        selection,
        organization,
        0,
        isMetricsData
      );
      menuOptions.push({
        key: 'open-in-discover',
        label: t('Open in Discover'),
        to: widget.queries.length === 1 ? discoverPath : undefined,
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
          openDashboardWidgetQuerySelectorModal({organization, widget, isMetricsData});
        },
      });
    }
  }

  if (widget.widgetType === WidgetType.ISSUE) {
    const issuesLocation = getWidgetIssueUrl(widget, selection, organization);

    menuOptions.push({
      key: 'open-in-issues',
      label: t('Open in Issues'),
      to: issuesLocation,
    });
  }

  if (widget.widgetType === WidgetType.METRICS) {
    const ddmLocation = getWidgetMetricsUrl(widget, selection, organization);

    menuOptions.push({
      key: 'open-in-metrics',
      label: t('Open in Metrics'),
      to: ddmLocation,
    });
  }

  if (organization.features.includes('dashboards-edit')) {
    menuOptions.push({
      key: 'duplicate-widget',
      label: t('Duplicate Widget'),
      onAction: () => onDuplicate?.(),
    });
    widgetLimitReached && disabledKeys.push('duplicate-widget');

    menuOptions.push({
      key: 'edit-widget',
      label: t('Edit Widget'),
      onAction: () => onEdit?.(),
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
    });
  }

  if (!menuOptions.length) {
    return null;
  }

  return (
    <WidgetViewerContext.Consumer>
      {({setData}) => (
        <MEPConsumer>
          {metricSettingContext => (
            <ContextWrapper>
              {!organization.features.includes('performance-mep-bannerless-ui') &&
                isMetricsData === false &&
                metricSettingContext &&
                metricSettingContext.metricSettingState !==
                  MEPState.TRANSACTIONS_ONLY && (
                  <SampledTag
                    tooltipText={t('This widget is only applicable to indexed events.')}
                  >
                    {t('Indexed')}
                  </SampledTag>
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
                disabledKeys={[...disabledKeys]}
              />
              <Button
                aria-label={t('Open Widget Viewer')}
                borderless
                size="xs"
                icon={openWidgetViewerIcon}
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
        </MEPConsumer>
      )}
    </WidgetViewerContext.Consumer>
  );
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
