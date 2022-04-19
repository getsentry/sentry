import styled from '@emotion/styled';
import {Location} from 'history';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import SimpleTableChart from 'sentry/components/charts/simpleTableChart';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import space from 'sentry/styles/space';
import {Organization, PageFilters} from 'sentry/types';
import {defined} from 'sentry/utils';
import {getIssueFieldRenderer} from 'sentry/utils/dashboards/issueFieldRenderers';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {eventViewFromWidget} from 'sentry/views/dashboardsV2/utils';

import {Widget} from '../types';
import {
  ISSUE_FIELD_TO_HEADER_MAP,
  ISSUE_FIELDS,
} from '../widgetBuilder/issueWidget/fields';

type Props = {
  loading: boolean;
  location: Location;
  organization: Organization;
  selection: PageFilters;
  transformedResults: TableDataRow[];
  widget: Widget;
  errorMessage?: string;
};

export function IssueWidgetCard({
  organization,
  selection,
  widget,
  errorMessage,
  loading,
  transformedResults,
  location,
}: Props) {
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

  const query = widget.queries[0];
  const queryFields = defined(query.fields)
    ? query.fields
    : [...query.columns, ...query.aggregates];
  const fieldAliases = query.fieldAliases ?? [];
  const eventView = eventViewFromWidget(
    widget.title,
    widget.queries[0],
    selection,
    widget.displayType
  );

  return (
    <StyledSimpleTableChart
      location={location}
      title=""
      eventView={eventView}
      fields={queryFields}
      fieldAliases={fieldAliases}
      loading={loading}
      metadata={ISSUE_FIELDS}
      data={transformedResults}
      organization={organization}
      getCustomFieldRenderer={getIssueFieldRenderer}
      fieldHeaderMap={ISSUE_FIELD_TO_HEADER_MAP}
      stickyHeaders
    />
  );
}

const LoadingPlaceholder = styled(Placeholder)`
  background-color: ${p => p.theme.surface200};
`;

const StyledSimpleTableChart = styled(SimpleTableChart)`
  margin-top: ${space(1.5)};
  border-bottom-left-radius: ${p => p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSizeMedium};
  box-shadow: none;
`;
