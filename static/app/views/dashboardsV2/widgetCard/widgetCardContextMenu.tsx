import styled from '@emotion/styled';
import * as qs from 'query-string';

import {openDashboardWidgetQuerySelectorModal} from 'sentry/actionCreators/modal';
import {parseArithmetic} from 'sentry/components/arithmeticInput/parser';
import {openConfirmModal} from 'sentry/components/confirm';
import DropdownMenuControlV2 from 'sentry/components/dropdownMenuControlV2';
import {MenuItemProps} from 'sentry/components/dropdownMenuItemV2';
import {
  IconCopy,
  IconDelete,
  IconEdit,
  IconEllipsis,
  IconIssues,
  IconTelescope,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getUtcDateString} from 'sentry/utils/dates';
import {isEquation, stripEquationPrefix} from 'sentry/utils/discover/fields';
import {DisplayModes} from 'sentry/utils/discover/types';
import {eventViewFromWidget} from 'sentry/views/dashboardsV2/utils';
import {DisplayType} from 'sentry/views/dashboardsV2/widget/utils';

import {Widget, WidgetType} from '../types';

type Props = {
  onDelete: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  widgetLimitReached: boolean;
  isPreview?: boolean;
  showContextMenu?: boolean;
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
}: Props) {
  if (!showContextMenu) {
    return null;
  }

  const menuOptions: MenuItemProps[] = [];
  const disabledKeys: string[] = [];

  if (isPreview) {
    return (
      <ContextWrapper>
        <DropdownMenuControlV2
          items={[
            {
              key: 'preview',
              label: t('This is a preview only. To edit, you must add this dashboard.'),
            },
          ]}
          triggerProps={{
            'aria-label': t('Widget actions'),
            size: 'xsmall',
            borderless: true,
            showChevron: false,
            icon: <IconEllipsis direction="down" size="sm" />,
          }}
          placement="bottom right"
          disabledKeys={['preview']}
        />
      </ContextWrapper>
    );
  }

  if (
    organization.features.includes('discover-basic') &&
    widget.widgetType === WidgetType.DISCOVER
  ) {
    // Open Widget in Discover
    if (widget.queries.length) {
      const eventView = eventViewFromWidget(
        widget.title,
        widget.queries[0],
        selection,
        widget.displayType
      );
      const discoverLocation = eventView.getResultsViewUrlTarget(organization.slug);
      // Pull a max of 3 valid Y-Axis from the widget
      const yAxisOptions = eventView.getYAxisOptions().map(({value}) => value);
      discoverLocation.query.yAxis = [
        ...new Set(
          widget.queries[0].fields.filter(field => yAxisOptions.includes(field))
        ),
      ].slice(0, 3);
      switch (widget.displayType) {
        case DisplayType.WORLD_MAP:
          discoverLocation.query.display = DisplayModes.WORLDMAP;
          break;
        case DisplayType.BAR:
          discoverLocation.query.display = DisplayModes.BAR;
          break;
        case DisplayType.TOP_N:
          discoverLocation.query.display = DisplayModes.TOP5;
          // Last field is used as the yAxis
          discoverLocation.query.yAxis =
            widget.queries[0].fields[widget.queries[0].fields.length - 1];
          discoverLocation.query.field = widget.queries[0].fields.slice(0, -1);
          break;
        default:
          break;
      }

      // Gather all fields and functions used in equations and prepend them to discover columns
      const termsSet: Set<string> = new Set();
      widget.queries[0].fields.forEach(field => {
        if (isEquation(field)) {
          const parsed = parseArithmetic(stripEquationPrefix(field)).tc;
          parsed.fields.forEach(({term}) => termsSet.add(term as string));
          parsed.functions.forEach(({term}) => termsSet.add(term as string));
        }
      });
      termsSet.forEach(term => {
        const fields = discoverLocation.query.field;
        if (Array.isArray(fields) && !fields.includes(term)) {
          fields.unshift(term);
        }
      });

      const discoverPath = `${discoverLocation.pathname}?${qs.stringify({
        ...discoverLocation.query,
      })}`;
      if (widget.queries.length === 1) {
        menuOptions.push({
          key: 'open-in-discover',
          label: t('Open in Discover'),
          leadingItems: <IconTelescope />,
          to: discoverPath,
          onAction: () => {
            trackAdvancedAnalyticsEvent('dashboards_views.open_in_discover.opened', {
              organization,
              widget_type: widget.displayType,
            });
          },
        });
      } else {
        menuOptions.push({
          key: 'open-discover',
          label: t('Open in Discover'),
          leadingItems: <IconTelescope />,
          onAction: () => {
            trackAdvancedAnalyticsEvent('dashboards_views.query_selector.opened', {
              organization,
              widget_type: widget.displayType,
            });
            openDashboardWidgetQuerySelectorModal({organization, widget});
          },
        });
      }
    }
  }

  if (widget.widgetType === WidgetType.ISSUE) {
    const {start, end, utc, period} = selection.datetime;
    const datetime =
      start && end
        ? {start: getUtcDateString(start), end: getUtcDateString(end), utc}
        : {statsPeriod: period};
    const issuesLocation = `/organizations/${organization.slug}/issues/?${qs.stringify({
      query: widget.queries?.[0]?.conditions,
      sort: widget.queries?.[0]?.orderby,
      ...datetime,
    })}`;

    menuOptions.push({
      key: 'open-in-issues',
      label: t('Open in Issues'),
      leadingItems: <IconIssues />,
      to: issuesLocation,
    });
  }

  if (organization.features.includes('dashboards-edit')) {
    menuOptions.push({
      key: 'duplicate-widget',
      label: t('Duplicate Widget'),
      leadingItems: <IconCopy />,
      onAction: () => onDuplicate(),
    });
    widgetLimitReached && disabledKeys.push('duplicate-widget');

    menuOptions.push({
      key: 'edit-widget',
      label: t('Edit Widget'),
      leadingItems: <IconEdit />,
      onAction: () => onEdit(),
    });

    menuOptions.push({
      key: 'delete-widget',
      label: t('Delete Widget'),
      leadingItems: <IconDelete />,
      onAction: () => {
        openConfirmModal({
          message: t('Are you sure you want to delete this widget?'),
          priority: 'danger',
          onConfirm: () => onDelete(),
        });
      },
    });
  }

  if (!menuOptions.length) {
    return null;
  }

  return (
    <ContextWrapper>
      <DropdownMenuControlV2
        items={menuOptions}
        triggerProps={{
          'aria-label': t('Widget actions'),
          size: 'xsmall',
          borderless: true,
          showChevron: false,
          icon: <IconEllipsis direction="down" size="sm" />,
        }}
        placement="bottom right"
        disabledKeys={disabledKeys}
      />
    </ContextWrapper>
  );
}

export default WidgetCardContextMenu;

const ContextWrapper = styled('div')`
  display: flex;
  align-items: center;
  height: ${space(3)};
  margin-left: ${space(1)};
`;
