import * as React from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {openDashboardWidgetQuerySelectorModal} from 'sentry/actionCreators/modal';
import Link from 'sentry/components/links/link';
import MenuItem from 'sentry/components/menuItem';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getUtcDateString} from 'sentry/utils/dates';
import {DisplayModes} from 'sentry/utils/discover/types';
import {eventViewFromWidget} from 'sentry/views/dashboardsV2/utils';
import {DisplayType} from 'sentry/views/dashboardsV2/widget/utils';

import ContextMenu from '../contextMenu';
import {Widget, WidgetType} from '../types';

type Props = {
  organization: Organization;
  widget: Widget;
  selection: PageFilters;
  onDuplicate: () => void;
  widgetLimitReached: boolean;
  showContextMenu?: boolean;
};

function WidgetCardContextMenu({
  organization,
  selection,
  widget,
  widgetLimitReached,
  onDuplicate,
  showContextMenu,
}: Props) {
  function isAllowWidgetsToDiscover() {
    return organization.features.includes('connect-discover-and-dashboards');
  }
  if (!showContextMenu) {
    return null;
  }

  const menuOptions: React.ReactNode[] = [];

  if (
    (widget.displayType === 'table' || isAllowWidgetsToDiscover()) &&
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
      if (isAllowWidgetsToDiscover()) {
        // Pull a max of 3 valid Y-Axis from the widget
        const yAxisOptions = eventView.getYAxisOptions().map(({value}) => value);
        discoverLocation.query.yAxis = widget.queries[0].fields
          .filter(field => yAxisOptions.includes(field))
          .slice(0, 3);
        switch (widget.displayType) {
          case DisplayType.WORLD_MAP:
            discoverLocation.query.display = DisplayModes.WORLDMAP;
            break;
          case DisplayType.BAR:
            discoverLocation.query.display = DisplayModes.BAR;
            break;
          default:
            break;
        }
      }
      if (widget.queries.length === 1) {
        menuOptions.push(
          <Link
            key="open-discover-link"
            to={discoverLocation}
            onClick={() => {
              trackAdvancedAnalyticsEvent('dashboards_views.open_in_discover.opened', {
                organization,
                widget_type: widget.displayType,
              });
            }}
          >
            <StyledMenuItem key="open-discover">{t('Open in Discover')}</StyledMenuItem>
          </Link>
        );
      } else {
        menuOptions.push(
          <StyledMenuItem
            key="open-discover"
            onClick={event => {
              event.preventDefault();
              trackAdvancedAnalyticsEvent('dashboards_views.query_selector.opened', {
                organization,
                widget_type: widget.displayType,
              });
              openDashboardWidgetQuerySelectorModal({organization, widget});
            }}
          >
            {t('Open in Discover')}
          </StyledMenuItem>
        );
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
      ...datetime,
    })}`;

    menuOptions.push(
      <Link to={issuesLocation} key="open-issues-link">
        <StyledMenuItem key="open-issues">{t('Open in Issues')}</StyledMenuItem>
      </Link>
    );
  }

  if (organization.features.includes('dashboards-edit')) {
    menuOptions.push(
      <StyledMenuItem
        key="duplicate-widget"
        data-test-id="duplicate-widget"
        onSelect={onDuplicate}
        disabled={widgetLimitReached}
      >
        {t('Duplicate Widget')}
      </StyledMenuItem>
    );
  }

  if (!menuOptions.length) {
    return null;
  }

  return (
    <ContextWrapper>
      <ContextMenu>{menuOptions}</ContextMenu>
    </ContextWrapper>
  );
}

export default WidgetCardContextMenu;

const ContextWrapper = styled('div')`
  margin-left: ${space(1)};
`;

const StyledMenuItem = styled(MenuItem)`
  white-space: nowrap;
  color: ${p => p.theme.textColor};
  :hover {
    color: ${p => p.theme.textColor};
  }
`;
