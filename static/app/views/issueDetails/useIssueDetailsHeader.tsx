import {useMemo} from 'react';

import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getMessage} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {Tab} from 'sentry/views/issueDetails/types';
import {ReprocessingStatus} from 'sentry/views/issueDetails/utils';

import {ShortIdBreadcrumb} from './shortIdBreadcrumb';

interface IssueDetailsHeaderProps {
  baseUrl: string;
  group: Group;
  groupReprocessingStatus: ReprocessingStatus;
  project: Project;
}

export function useIssueDetailsHeader({
  group,
  groupReprocessingStatus,
  baseUrl,
  project,
}: IssueDetailsHeaderProps) {
  const location = useLocation();
  const organization = useOrganization();
  const {sort: _sort, query: _query, ...query} = location.query;

  const disabledTabs = useMemo(() => {
    if (groupReprocessingStatus === ReprocessingStatus.REPROCESSING) {
      return [
        Tab.ACTIVITY,
        Tab.USER_FEEDBACK,
        Tab.ATTACHMENTS,
        Tab.EVENTS,
        Tab.MERGED,
        Tab.SIMILAR_ISSUES,
        Tab.TAGS,
      ];
    }

    if (groupReprocessingStatus === ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT) {
      return [
        Tab.DETAILS,
        Tab.ATTACHMENTS,
        Tab.EVENTS,
        Tab.MERGED,
        Tab.SIMILAR_ISSUES,
        Tab.TAGS,
        Tab.USER_FEEDBACK,
      ];
    }

    return [];
  }, [groupReprocessingStatus]);

  const disableActions = !!disabledTabs.length;

  const message = getMessage(group);

  const eventRoute = useMemo(() => {
    return {
      pathname: `${baseUrl}events/`,
      query,
    };
  }, [query, baseUrl]);

  const shortIdBreadcrumb = (
    <ShortIdBreadcrumb organization={organization} project={project} group={group} />
  );

  let className = 'group-detail';

  if (group.hasSeen) {
    className += ' hasSeen';
  }

  if (group.status === 'resolved') {
    className += ' isResolved';
  }

  return {
    disabledTabs,
    message,
    eventRoute,
    disableActions,
    shortIdBreadcrumb,
    className,
  };
}
