import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {openDashboardWidgetQuerySelectorModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import DropdownMenuControlV2 from 'sentry/components/dropdownMenuControlV2';
import {MenuItemProps} from 'sentry/components/dropdownMenuItemV2';
import {isWidgetViewerPath} from 'sentry/components/modals/widgetViewerModal/utils';
import {IconEllipsis, IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getWidgetDiscoverUrl, getWidgetIssueUrl} from 'sentry/views/dashboardsV2/utils';

import {Widget, WidgetType} from '../types';

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
  showContextMenu?: boolean;
  showWidgetViewerButton?: boolean;
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
  showWidgetViewerButton,
  router,
  location,
  index,
}: Props) {
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

  if (isPreview) {
    return (
      <ContextWrapper>
        <StyledDropdownMenuControlV2
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
        {showWidgetViewerButton && (
          <OpenWidgetViewerButton
            aria-label={t('Open Widget Viewer')}
            priority="link"
            size="zero"
            icon={<IconExpand size="xs" />}
            onClick={() => openWidgetViewerPath(index)}
          />
        )}
      </ContextWrapper>
    );
  }

  if (
    organization.features.includes('discover-basic') &&
    widget.widgetType === WidgetType.DISCOVER
  ) {
    // Open Widget in Discover
    if (widget.queries.length) {
      const discoverPath = getWidgetDiscoverUrl(widget, selection, organization);
      menuOptions.push({
        key: 'open-in-discover',
        label: t('Open in Discover'),
        to: widget.queries.length === 1 ? discoverPath : undefined,
        onAction: () => {
          if (widget.queries.length === 1) {
            trackAdvancedAnalyticsEvent('dashboards_views.open_in_discover.opened', {
              organization,
              widget_type: widget.displayType,
            });
            return;
          }

          trackAdvancedAnalyticsEvent('dashboards_views.query_selector.opened', {
            organization,
            widget_type: widget.displayType,
          });
          openDashboardWidgetQuerySelectorModal({organization, widget});
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
    <ContextWrapper>
      <StyledDropdownMenuControlV2
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
      {showWidgetViewerButton && (
        <OpenWidgetViewerButton
          aria-label={t('Open Widget Viewer')}
          priority="link"
          size="zero"
          icon={<IconExpand size="xs" />}
          onClick={() => openWidgetViewerPath(widget.id ?? index)}
        />
      )}
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

const StyledDropdownMenuControlV2 = styled(DropdownMenuControlV2)`
  & > button {
    z-index: auto;
  }
`;

const OpenWidgetViewerButton = styled(Button)`
  padding: ${space(0.75)} ${space(1)};
  color: ${p => p.theme.textColor};
  &:hover {
    color: ${p => p.theme.textColor};
    background: ${p => p.theme.surface400};
    border-color: transparent;
  }
`;
