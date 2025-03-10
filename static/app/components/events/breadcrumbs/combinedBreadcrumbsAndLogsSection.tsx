import {Fragment} from 'react';

import type {BreadcrumbsDataSectionProps} from 'sentry/components/events/breadcrumbs/breadcrumbsDataSection';
import BreadcrumbsDataSection from 'sentry/components/events/breadcrumbs/breadcrumbsDataSection';
import useOrganization from 'sentry/utils/useOrganization';
import {LogsPageParamsProvider} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  LogsTableDataProvider,
  useLogsTableData,
} from 'sentry/views/explore/contexts/logs/logsTableData';
import {LogsIssuesSection} from 'sentry/views/explore/logs/logsIssuesSection';

/**
 * This component is a coordinator and provider wrapper to determine which section to display, collapse etc. since only one section should be displayed by default.
 */
export function CombinedBreadcrumbsAndLogsSection({
  event,
  group,
  project,
}: BreadcrumbsDataSectionProps) {
  const organization = useOrganization();
  const feature = organization.features.includes('ourlogs-enabled');
  if (!feature) {
    // If we don't have the feature, we should skip the providers as they make api calls.
    return <BreadcrumbsDataSection event={event} group={group} project={project} />;
  }

  return (
    <LogsPageParamsProvider>
      <LogsTableDataProvider>
        <CombinedBreadcrumbsAndLogsSectionContent
          event={event}
          group={group}
          project={project}
        />
      </LogsTableDataProvider>
    </LogsPageParamsProvider>
  );
}

function CombinedBreadcrumbsAndLogsSectionContent({
  event,
  group,
  project,
}: BreadcrumbsDataSectionProps) {
  const {tableData} = useLogsTableData();
  const collapseLogs = tableData.data.length === 0;
  return (
    <Fragment>
      <BreadcrumbsDataSection
        event={event}
        group={group}
        project={project}
        initialCollapse={!collapseLogs}
      />
      <LogsIssuesSection initialCollapse={collapseLogs} />
    </Fragment>
  );
}
