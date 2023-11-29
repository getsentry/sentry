import {useMemo} from 'react';
import styled from '@emotion/styled';
import {urlEncode} from '@sentry/utils';

import {openAddToDashboardModal} from 'sentry/actionCreators/modal';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {MetricDisplayType, MetricsQuery} from 'sentry/utils/metrics';
import {hasDDMFeature} from 'sentry/utils/metrics/features';
import {MRIToField, parseMRI} from 'sentry/utils/metrics/mri';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {DashboardWidgetSource, WidgetType} from 'sentry/views/dashboards/types';

type ContextMenuProps = {
  displayType: MetricDisplayType;
  metricsQuery: MetricsQuery;
};

export function MetricWidgetContextMenu({metricsQuery, displayType}: ContextMenuProps) {
  const organization = useOrganization();
  const createAlertUrl = useCreateAlertUrl(organization, metricsQuery);
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
          disabled: !createAlertUrl,
          to: createAlertUrl,
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

function useCreateAlertUrl(organization: Organization, metricsQuery: MetricsQuery) {
  const projects = useProjects();
  const pageFilters = usePageFilters();
  const selectedProjects = pageFilters.selection.projects;
  const firstProjectSlug =
    selectedProjects.length > 0 &&
    projects.projects.find(p => p.id === selectedProjects[0].toString())?.slug;

  return useMemo(() => {
    if (
      !firstProjectSlug ||
      !metricsQuery.mri ||
      !metricsQuery.op ||
      parseMRI(metricsQuery.mri)?.useCase !== 'custom'
    ) {
      return undefined;
    }

    return {
      pathname: `/organizations/${organization.slug}/alerts/new/metric/`,
      query: {
        // Needed, so alerts-create also collects environment via event view
        createFromDiscover: true,
        dataset: Dataset.GENERIC_METRICS,
        eventTypes: EventTypes.TRANSACTION,
        aggregate: MRIToField(metricsQuery.mri, metricsQuery.op as string),
        referrer: 'ddm',
        // Event type also needs to be added to the query
        query: `${metricsQuery.query}  event.type:transaction`.trim(),
        environment: metricsQuery.environments,
        project: firstProjectSlug,
      },
    };
  }, [
    firstProjectSlug,
    metricsQuery.environments,
    metricsQuery.mri,
    metricsQuery.op,
    metricsQuery.query,
    organization.slug,
  ]);
}

const StyledDropdownMenuControl = styled(DropdownMenu)`
  margin: ${space(1)};
`;
