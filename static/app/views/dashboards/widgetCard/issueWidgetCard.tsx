import styled from '@emotion/styled';
import type {Location} from 'history';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import SimpleTableChart from 'sentry/components/charts/simpleTableChart';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type {MetaType} from 'sentry/utils/discover/eventView';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import type {Widget} from 'sentry/views/dashboards/types';
import {WidgetType} from 'sentry/views/dashboards/types';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';

type Props = {
  loading: boolean;
  location: Location;
  selection: PageFilters;
  widget: Widget;
  errorMessage?: string;
  tableResults?: TableData[];
};

export function IssueWidgetCard({
  selection,
  widget,
  errorMessage,
  loading,
  tableResults,
  location,
}: Props) {
  const datasetConfig = getDatasetConfig(WidgetType.ISSUE);

  if (errorMessage) {
    return (
      <ErrorPanel>
        <IconWarning color="gray500" size="lg" />
      </ErrorPanel>
    );
  }

  if (loading) {
    // Align height to other charts.
    return <LoadingPlaceholder height="200px" />;
  }

  const query = widget.queries[0]!;
  const queryFields = defined(query.fields)
    ? query.fields
    : [...query.columns, ...query.aggregates];
  const fieldAliases = query.fieldAliases ?? [];
  const eventView = eventViewFromWidget(widget.title, widget.queries[0]!, selection);

  const getCustomFieldRenderer = (
    field: string,
    meta: MetaType,
    organization?: Organization
  ) => {
    return (
      datasetConfig.getCustomFieldRenderer?.(field, meta, widget, organization) || null
    );
  };

  return (
    <StyledSimpleTableChart
      location={location}
      title=""
      eventView={eventView}
      fields={queryFields}
      fieldAliases={fieldAliases}
      loading={loading}
      metadata={tableResults?.[0]?.meta}
      data={tableResults?.[0]?.data}
      getCustomFieldRenderer={getCustomFieldRenderer}
      fieldHeaderMap={datasetConfig.getFieldHeaderMap?.()}
      stickyHeaders
    />
  );
}

const LoadingPlaceholder = styled(Placeholder)`
  background-color: ${p => p.theme.surface300};
`;

const StyledSimpleTableChart = styled(SimpleTableChart)`
  margin-top: ${space(1.5)};
  border-bottom-left-radius: ${p => p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSizeMedium};
  box-shadow: none;
`;
