import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';

import {openAddToDashboardModal} from 'sentry/actionCreators/modal';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {MetricDisplayType, MetricsQuery} from 'sentry/utils/metrics';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {DashboardWidgetSource} from 'sentry/views/dashboards/types';

type ContextMenuProps = {
  metricsQuery: MetricsQuery;
  displayType?: MetricDisplayType;
};

export function MetricWidgetContextMenu({metricsQuery, displayType}: ContextMenuProps) {
  const organization = useOrganization();
  const router = useRouter();

  if (!organization.features.includes('ddm-experimental')) {
    return null;
  }

  return (
    <StyledDropdownMenuControl
      items={[
        {
          key: 'add-alert',
          label: t('Create Alert'),
          disabled: true,
        },
        {
          key: 'add-dashoard',
          label: t('Add to Dashboard'),
          onAction: () => {
            handleAddQueryToDashboard(metricsQuery, organization, router, displayType);
          },
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

function handleAddQueryToDashboard(
  {projects, environments, datetime, op, mri}: MetricsQuery,
  organization: Organization,
  router: InjectedRouter,
  displayType?: MetricDisplayType
) {
  const {start, end, period} = datetime;
  // TODO(ddm): make a util that does this
  const field = op ? `${op}(${mri})` : mri;

  const widgetAsQueryParams = {
    ...router.location?.query,
    source: DashboardWidgetSource.DDM,
    start,
    end,
    statsPeriod: period,
    defaultWidgetQuery: field,
    defaultTableColumns: [],
    defaultTitle: 'DDM Widget',
    displayType,
  };

  openAddToDashboardModal({
    organization,
    selection: {
      projects,
      environments,
      datetime,
    },
    widget: {
      title: 'DDM Widget',
      displayType,
      widgetType: 'custom-metrics',
      queries: [
        {
          name: '',
          aggregates: [field],
          columns: [],
          fields: [field],
          conditions: '',
        },
      ],
    },
    router,
    widgetAsQueryParams,
    location: router.location,
  });
}

const StyledDropdownMenuControl = styled(DropdownMenu)`
  margin: ${space(1)};
`;
