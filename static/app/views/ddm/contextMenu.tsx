import styled from '@emotion/styled';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconDashboard, IconEllipsis, IconSiren} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MetricDisplayType, MetricsQuery} from 'sentry/utils/metrics';
import {hasDDMFeature} from 'sentry/utils/metrics/features';
import {useCreateAlert} from 'sentry/utils/metrics/useCreateAlert';
import {useCreateDashboardWidget} from 'sentry/utils/metrics/useCreateDashboardWidget';
import useOrganization from 'sentry/utils/useOrganization';

type ContextMenuProps = {
  displayType: MetricDisplayType;
  metricsQuery: MetricsQuery;
};

export function MetricWidgetContextMenu({metricsQuery, displayType}: ContextMenuProps) {
  const organization = useOrganization();
  const createAlert = useCreateAlert(organization, metricsQuery);
  const createDashboardWidget = useCreateDashboardWidget(
    organization,
    metricsQuery,
    displayType
  );

  if (!hasDDMFeature(organization)) {
    return null;
  }

  return (
    <StyledDropdownMenuControl
      items={[
        {
          leadingItems: [<IconSiren key="icon" />],
          key: 'add-alert',
          label: t('Create Alert'),
          disabled: !createAlert,
          onAction: createAlert,
        },
        {
          leadingItems: [<IconDashboard key="icon" />],
          key: 'add-dashoard',
          label: t('Add to Dashboard'),
          disabled: !createDashboardWidget,
          onAction: createDashboardWidget,
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
  );
}

const StyledDropdownMenuControl = styled(DropdownMenu)`
  margin: ${space(1)};
`;
