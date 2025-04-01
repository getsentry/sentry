import {Fragment} from 'react';

import type {BreadcrumbsDataSectionProps} from 'sentry/components/events/breadcrumbs/breadcrumbsDataSection';
import BreadcrumbsDataSection from 'sentry/components/events/breadcrumbs/breadcrumbsDataSection';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import useOrganization from 'sentry/utils/useOrganization';
import {LogsPageParamsProvider} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LogsIssuesSection} from 'sentry/views/explore/logs/logsIssuesSection';
import {useExploreLogsTable} from 'sentry/views/explore/logs/useLogsQuery';

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
    <LogsPageParamsProvider
      isOnEmbeddedView
      limitToTraceId={event.contexts?.trace?.trace_id}
      analyticsPageSource={LogsAnalyticsPageSource.ISSUE_DETAILS}
    >
      <CombinedBreadcrumbsAndLogsSectionContent
        event={event}
        group={group}
        project={project}
      />
    </LogsPageParamsProvider>
  );
}

function CombinedBreadcrumbsAndLogsSectionContent({
  event,
  group,
  project,
}: BreadcrumbsDataSectionProps) {
  const tableData = useExploreLogsTable({});
  const shouldCollapseLogs = tableData.data.length === 0;
  return (
    <Fragment>
      <BreadcrumbsDataSection
        event={event}
        group={group}
        project={project}
        initialCollapse={!shouldCollapseLogs}
      />
      <LogsIssuesSection
        initialCollapse={shouldCollapseLogs}
        isOnEmbeddedView
        limitToTraceId={event.contexts?.trace?.trace_id}
        event={event}
        group={group}
        project={project}
      />
    </Fragment>
  );
}
