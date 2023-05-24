import uniq from 'lodash/uniq';

import ConfigStore from 'sentry/stores/configStore';
import {
  BaseGroup,
  EntryException,
  EntryThreads,
  EventMetadata,
  EventOrGroupType,
  Group,
  GroupActivityAssigned,
  GroupActivityType,
  GroupTombstone,
  IssueCategory,
  IssueType,
  TreeLabelPart,
} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import type {BaseEventAnalyticsParams} from 'sentry/utils/analytics/workflowAnalyticsEvents';
import {getDaysSinceDatePrecise} from 'sentry/utils/getDaysSinceDate';
import {isMobilePlatform, isNativePlatform} from 'sentry/utils/platform';
import {getReplayIdFromEvent} from 'sentry/utils/replays/getReplayIdFromEvent';

function isTombstone(maybe: BaseGroup | Event | GroupTombstone): maybe is GroupTombstone {
  return !maybe.hasOwnProperty('type');
}

/**
 * Extract the display message from an event.
 */
export function getMessage(
  event: Event | BaseGroup | GroupTombstone
): string | undefined {
  if (isTombstone(event)) {
    return event.culprit || '';
  }

  const {metadata, type, culprit} = event;

  switch (type) {
    case EventOrGroupType.ERROR:
    case EventOrGroupType.TRANSACTION:
      return metadata.value;
    case EventOrGroupType.CSP:
      return metadata.message;
    case EventOrGroupType.EXPECTCT:
    case EventOrGroupType.EXPECTSTAPLE:
    case EventOrGroupType.HPKP:
      return '';
    case EventOrGroupType.GENERIC:
      return metadata.value;
    default:
      return culprit || '';
  }
}

/**
 * Get the location from an event.
 */
export function getLocation(event: Event | BaseGroup | GroupTombstone) {
  if (isTombstone(event)) {
    return undefined;
  }

  if (event.type === EventOrGroupType.ERROR && isNativePlatform(event.platform)) {
    return event.metadata.filename || undefined;
  }

  return undefined;
}

export function getTreeLabelPartDetails(part: TreeLabelPart) {
  // Note: This function also exists in Python in eventtypes/base.py, to make
  // porting efforts simpler it's recommended to keep both variants
  // structurally similar.
  if (typeof part === 'string') {
    return part;
  }

  const label = part?.function || part?.package || part?.filebase || part?.type;
  const classbase = part?.classbase;

  if (classbase) {
    return label ? `${classbase}.${label}` : classbase;
  }

  return label || '<unknown>';
}

function computeTitleWithTreeLabel(metadata: EventMetadata) {
  const {type, current_tree_label, finest_tree_label} = metadata;

  const treeLabel = current_tree_label || finest_tree_label;

  const formattedTreeLabel = treeLabel
    ? treeLabel.map(labelPart => getTreeLabelPartDetails(labelPart)).join(' | ')
    : undefined;

  if (!type) {
    return {
      title: formattedTreeLabel || metadata.function || '<unknown>',
      treeLabel,
    };
  }

  if (!formattedTreeLabel) {
    return {title: type, treeLabel: undefined};
  }

  return {
    title: `${type} | ${formattedTreeLabel}`,
    treeLabel: [{type}, ...(treeLabel ?? [])],
  };
}

export function getTitle(
  event: Event | BaseGroup,
  features: string[] = [],
  grouping = false
) {
  const {metadata, type, culprit, title} = event;
  const customTitle = metadata?.title;

  switch (type) {
    case EventOrGroupType.ERROR: {
      if (customTitle) {
        return {
          title: customTitle,
          subtitle: culprit,
          treeLabel: undefined,
        };
      }

      const displayTitleWithTreeLabel =
        features.includes('grouping-title-ui') &&
        (grouping ||
          isNativePlatform(event.platform) ||
          isMobilePlatform(event.platform));

      if (displayTitleWithTreeLabel) {
        return {
          subtitle: culprit,
          ...computeTitleWithTreeLabel(metadata),
        };
      }

      return {
        subtitle: culprit,
        title: metadata.type || metadata.function || '<unknown>',
        treeLabel: undefined,
      };
    }
    case EventOrGroupType.CSP:
      return {
        title: customTitle ?? metadata.directive ?? '',
        subtitle: metadata.uri ?? '',
        treeLabel: undefined,
      };
    case EventOrGroupType.EXPECTCT:
    case EventOrGroupType.EXPECTSTAPLE:
    case EventOrGroupType.HPKP:
      // Due to a regression some reports did not have message persisted
      // (https://github.com/getsentry/sentry/pull/19794) so we need to fall
      // back to the computed title for these.
      return {
        title: customTitle ?? (metadata.message || title),
        subtitle: metadata.origin ?? '',
        treeLabel: undefined,
      };
    case EventOrGroupType.DEFAULT:
      return {
        title: customTitle ?? metadata.title ?? '',
        subtitle: '',
        treeLabel: undefined,
      };
    case EventOrGroupType.TRANSACTION:
      const isPerfIssue = event.issueCategory === IssueCategory.PERFORMANCE;
      return {
        title: isPerfIssue ? metadata.title : customTitle ?? title,
        subtitle: isPerfIssue ? culprit : '',
        treeLabel: undefined,
      };
    case EventOrGroupType.GENERIC:
      const isProfilingIssue = event.issueCategory === IssueCategory.PROFILE;
      return {
        title: isProfilingIssue ? metadata.title : customTitle ?? title,
        subtitle: isProfilingIssue ? culprit : '',
        treeLabel: undefined,
      };
    default:
      return {
        title: customTitle ?? title,
        subtitle: '',
        treeLabel: undefined,
      };
  }
}

/**
 * Returns a short eventId with only 8 characters
 */
export function getShortEventId(eventId: string) {
  return eventId.substring(0, 8);
}

/**
 * Returns a comma delineated list of errors
 */
function getEventErrorString(event: Event) {
  return uniq(event.errors?.map(error => error.type)).join(',') || '';
}

function hasTrace(event: Event) {
  if (event.type !== 'error') {
    return false;
  }
  return !!event.contexts?.trace;
}

/**
 * Function to determine if an event has source maps
 * by ensuring that every inApp frame has a valid sourcemap
 */
export function eventHasSourceMaps(event: Event) {
  const inAppFrames = getInAppFrames(event);

  // the map field tells us if it's sourcemapped
  return inAppFrames.every(frame => !!frame.map);
}

/**
 * Function to get status about how many frames have source maps
 */
export function getFrameBreakdownOfSourcemaps(event?: Event | null) {
  if (!event) {
    // return undefined if there is no event
    return {};
  }
  const inAppFrames = getInAppFrames(event);
  if (!inAppFrames.length) {
    return {};
  }

  return {
    framesWithSourcemapsPercent:
      (inAppFrames.filter(frame => !!frame.map).length * 100) / inAppFrames.length,
    framesWithoutSourceMapsPercent:
      (inAppFrames.filter(frame => !frame.map).length * 100) / inAppFrames.length,
  };
}

function getInAppFrames(event: Event) {
  const exceptions = getExceptionEntries(event);
  return exceptions
    .map(exception => exception.data.values || [])
    .flat()
    .map(exceptionValue => exceptionValue?.stacktrace?.frames || [])
    .flat()
    .filter(frame => frame.inApp);
}

function getExceptionEntries(event: Event) {
  return (event.entries?.filter(entry => entry.type === 'exception') ||
    []) as EntryException[];
}

function getNumberOfStackFrames(event: Event) {
  const entries = getExceptionEntries(event);
  // for each entry, go through each frame and get the max
  const frameLengths =
    entries?.map(entry =>
      (entry.data.values || []).reduce((best, exception) => {
        // find the max number of frames in this entry
        const frameCount = exception.stacktrace?.frames?.length || 0;
        return Math.max(best, frameCount);
      }, 0)
    ) || [];
  if (!frameLengths.length) {
    return 0;
  }
  return Math.max(...frameLengths);
}

function getNumberOfInAppStackFrames(event: Event) {
  const entries = getExceptionEntries(event);
  // for each entry, go through each frame
  const frameLengths =
    entries?.map(entry =>
      (entry.data.values || []).reduce((best, exception) => {
        // find the max number of frames in this entry
        const frames = exception.stacktrace?.frames?.filter(f => f.inApp) || [];
        return Math.max(best, frames.length);
      }, 0)
    ) || [];
  if (!frameLengths.length) {
    return 0;
  }
  return Math.max(...frameLengths);
}

function getNumberOfThreadsWithNames(event: Event) {
  const threadLengths =
    (
      (event.entries?.filter(entry => entry.type === 'threads') || []) as EntryThreads[]
    ).map(entry => entry.data?.values?.filter(thread => !!thread.name).length || 0) || [];
  if (!threadLengths.length) {
    return 0;
  }
  return Math.max(...threadLengths);
}

/**
 * Return the integration type for the first assignment via integration
 */
function getAssignmentIntegration(group: Group) {
  if (!group.activity) {
    return '';
  }
  const assignmentAcitivies = group.activity.filter(
    activity => activity.type === GroupActivityType.ASSIGNED
  ) as GroupActivityAssigned[];
  const integrationAssignments = assignmentAcitivies.find(
    activity => !!activity.data.integration
  );
  return integrationAssignments?.data.integration || '';
}

export function getAnalyticsDataForEvent(event?: Event | null): BaseEventAnalyticsParams {
  const {framesWithSourcemapsPercent, framesWithoutSourceMapsPercent} =
    getFrameBreakdownOfSourcemaps(event);
  return {
    event_id: event?.eventID || '-1',
    num_commits: event?.release?.commitCount || 0,
    num_stack_frames: event ? getNumberOfStackFrames(event) : 0,
    num_in_app_stack_frames: event ? getNumberOfInAppStackFrames(event) : 0,
    num_threads_with_names: event ? getNumberOfThreadsWithNames(event) : 0,
    event_platform: event?.platform,
    event_type: event?.type,
    has_release: !!event?.release,
    has_source_maps: event ? eventHasSourceMaps(event) : false,
    has_trace: event ? hasTrace(event) : false,
    has_commit: !!event?.release?.lastCommit,
    event_errors: event ? getEventErrorString(event) : '',
    frames_with_sourcemaps_percent: framesWithSourcemapsPercent,
    frames_without_source_maps_percent: framesWithoutSourceMapsPercent,
    sdk_name: event?.sdk?.name,
    sdk_version: event?.sdk?.version,
    release_user_agent: event?.release?.userAgent,
    error_has_replay: Boolean(getReplayIdFromEvent(event)),
    error_has_user_feedback: defined(event?.userReport),
    has_otel: event?.contexts?.otel !== undefined,
  };
}

export type CommonGroupAnalyticsData = {
  days_since_last_seen: number;
  error_count: number;
  group_id: number;
  group_num_user_feedback: number;
  has_external_issue: boolean;
  has_owner: boolean;
  integration_assignment_source: string;
  issue_age: number;
  issue_category: IssueCategory;
  issue_id: number;
  issue_type: IssueType;
  num_comments: number;
  num_participants: number;
  num_viewers: number;
  is_assigned?: boolean;
  issue_level?: string;
  issue_status?: string;
  issue_substatus?: string;
};

export function getAnalyticsDataForGroup(group?: Group | null): CommonGroupAnalyticsData {
  const groupId = group ? parseInt(group.id, 10) : -1;
  const activeUser = ConfigStore.get('user');

  return {
    group_id: groupId,
    // overload group_id with the issue_id
    issue_id: groupId,
    issue_category: group?.issueCategory ?? IssueCategory.ERROR,
    issue_type: group?.issueType ?? IssueType.ERROR,
    issue_status: group?.status,
    issue_substatus: group?.substatus,
    issue_age: group?.firstSeen ? getDaysSinceDatePrecise(group.firstSeen) : -1,
    days_since_last_seen: group?.lastSeen ? getDaysSinceDatePrecise(group.lastSeen) : -1,
    issue_level: group?.level,
    is_assigned: !!group?.assignedTo,
    error_count: Number(group?.count || -1),
    num_comments: group ? group.numComments : -1,
    has_external_issue: group?.annotations ? group?.annotations.length > 0 : false,
    has_owner: group?.owners ? group?.owners.length > 0 : false,
    integration_assignment_source: group ? getAssignmentIntegration(group) : '',
    num_participants: group?.participants?.length ?? 0,
    num_viewers: group?.seenBy?.filter(user => user.id !== activeUser?.id).length ?? 0,
    group_num_user_feedback: group?.userReportCount ?? 0,
  };
}
