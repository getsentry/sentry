import {useMemo} from 'react';
import styled from '@emotion/styled';
import {urlEncode} from '@sentry/utils';

import {openAddToDashboardModal, openModal} from 'sentry/actionCreators/modal';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {MetricDisplayType, MetricsQuery} from 'sentry/utils/metrics';
import {hasDDMFeature} from 'sentry/utils/metrics/features';
import {MRIToField, parseMRI} from 'sentry/utils/metrics/mri';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {DashboardWidgetSource, WidgetType} from 'sentry/views/dashboards/types';
import {CreateAlertModal} from 'sentry/views/ddm/createAlertModal';
import {OrganizationContext} from 'sentry/views/organizationContext';

type ContextMenuProps = {
  displayType: MetricDisplayType;
  metricsQuery: MetricsQuery;
};

export function MetricWidgetContextMenu({metricsQuery, displayType}: ContextMenuProps) {
  const organization = useOrganization();
  const createAlert = useCreateAlert(organization, metricsQuery);
  const handleAddQueryToDashboard = useHandleAddQueryToDashboard(
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
          key: 'add-alert',
          label: t('Create Alert'),
          disabled: !createAlert,
          onAction: createAlert,
        },
        {
          key: 'add-dashoard',
          label: t('Add to Dashboard'),
          disabled: !handleAddQueryToDashboard,
          onAction: handleAddQueryToDashboard,
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

function useHandleAddQueryToDashboard(
  organization: Organization,
  {projects, environments, datetime, op, mri, groupBy, query}: MetricsQuery,
  displayType?: MetricDisplayType
) {
  const router = useRouter();
  const {start, end, period} = datetime;

  return useMemo(() => {
    if (!mri || !op) {
      return undefined;
    }

    const field = MRIToField(mri, op);
    const limit = !groupBy?.length ? 1 : 10;

    const widgetQuery = {
      name: '',
      aggregates: [field],
      columns: groupBy ?? [],
      fields: [field],
      conditions: query ?? '',
      orderby: '',
    };

    const urlWidgetQuery = urlEncode({
      ...widgetQuery,
      aggregates: field,
      fields: field,
      columns: groupBy?.join(',') ?? '',
    });

    const widgetAsQueryParams = {
      source: DashboardWidgetSource.DDM,
      start,
      end,
      statsPeriod: period,
      defaultWidgetQuery: urlWidgetQuery,
      defaultTableColumns: [],
      defaultTitle: 'DDM Widget',
      environment: environments,
      displayType,
      project: projects,
    };

    return () =>
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
          widgetType: WidgetType.METRICS,
          limit,
          queries: [widgetQuery],
        },
        router,
        widgetAsQueryParams,
        location: router.location,
      });
  }, [
    datetime,
    displayType,
    end,
    environments,
    groupBy,
    mri,
    op,
    organization,
    period,
    projects,
    query,
    router,
    start,
  ]);
}

function useCreateAlert(organization: Organization, metricsQuery: MetricsQuery) {
  return useMemo(() => {
    if (
      !metricsQuery.mri ||
      !metricsQuery.op ||
      parseMRI(metricsQuery.mri)?.useCase !== 'custom' ||
      !organization.access.includes('alerts:write')
    ) {
      return undefined;
    }
    return () =>
      openModal(deps => (
        <OrganizationContext.Provider value={organization}>
          <CreateAlertModal metricsQuery={metricsQuery} {...deps} />
        </OrganizationContext.Provider>
      ));
  }, [metricsQuery, organization]);
}

const StyledDropdownMenuControl = styled(DropdownMenu)`
  margin: ${space(1)};
`;
