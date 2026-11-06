import type React from 'react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';

import {
  AgeComparisonDetails,
  AgeComparisonNode,
  validateAgeComparisonCondition,
} from './actionFilters/ageComparison';
import {
  AssignedToDetails,
  AssignedToNode,
  validateAssignedToCondition,
} from './actionFilters/assignedTo';
import {
  AgeComparison,
  Attribute,
  Interval,
  Level,
  MatchType,
  ModelAge,
  Priority,
  TargetType,
  TimeUnit,
} from './actionFilters/constants';
import {
  EventAttributeDetails,
  EventAttributeNode,
  validateEventAttributeCondition,
} from './actionFilters/eventAttribute';
import {
  EventFrequencyCountDetails,
  EventFrequencyNode,
  EventFrequencyPercentDetails,
  validateEventFrequencyCondition,
} from './actionFilters/eventFrequency';
import {
  EventUniqueUserFrequencyCountDetails,
  EventUniqueUserFrequencyNode,
  EventUniqueUserFrequencyPercentDetails,
  validateEventUniqueUserFrequencyCondition,
} from './actionFilters/eventUniqueUserFrequency';
import {
  IssueCategoryDetails,
  IssueCategoryNode,
  validateIssueCategoryCondition,
} from './actionFilters/issueCategory';
import {
  IssueOccurrencesDetails,
  IssueOccurrencesNode,
  validateIssueOccurrencesCondition,
} from './actionFilters/issueOccurrences';
import {
  IssuePriorityDetails,
  IssuePriorityNode,
  validateIssuePriorityCondition,
} from './actionFilters/issuePriority';
import {IssuePriorityDeescalating} from './actionFilters/issuePriorityDeescalating';
import {
  IssueTypeDetails,
  IssueTypeNode,
  validateIssueTypeCondition,
} from './actionFilters/issueType';
import {
  LatestAdoptedReleaseDetails,
  LatestAdoptedReleaseNode,
  validateLatestAdoptedReleaseCondition,
} from './actionFilters/latestAdoptedRelease';
import {LatestReleaseNode} from './actionFilters/latestRelease';
import {LevelDetails, LevelNode, validateLevelCondition} from './actionFilters/level';
import {
  PercentSessionsCountDetails,
  PercentSessionsNode,
  PercentSessionsPercentDetails,
  validatePercentSessionsCondition,
} from './actionFilters/percentSessions';
import {
  SeerActivityTriggerDetails,
  SeerActivityTriggerNode,
  validateSeerActivityTriggerCondition,
} from './actionFilters/seerActivityTrigger';
import {
  TaggedEventDetails,
  TaggedEventNode,
  validateTaggedEventCondition,
} from './actionFilters/taggedEvent';
import type {ValidateDataConditionProps} from './automationFormData';
import type {DataConditionNodeComponentProps} from './dataConditionNodeContext';

type DataConditionNode = {
  label: string;
  validate: (({condition}: ValidateDataConditionProps) => string | undefined) | undefined;
  dataCondition?: React.ComponentType<DataConditionNodeComponentProps>;
  defaultComparison?: any;
  details?: React.ComponentType<any>;
  warningMessage?: React.ComponentType<any>;
};

export const dataConditionNodesMap = new Map<DataConditionType, DataConditionNode>([
  [
    DataConditionType.FIRST_SEEN_EVENT,
    {
      label: t('A new issue is created'),
      validate: undefined,
    },
  ],
  [
    DataConditionType.ISSUE_RESOLVED_TRIGGER,
    {
      label: t('An issue is resolved'),
      validate: undefined,
    },
  ],
  [
    DataConditionType.EVERY_EVENT,
    {
      label: t('An event or issue activity is captured'),
      validate: undefined,
    },
  ],
  [
    DataConditionType.REGRESSION_EVENT,
    {
      label: t('A resolved issue regresses'),
      validate: undefined,
    },
  ],
  [
    DataConditionType.REAPPEARED_EVENT,
    {
      label: t('An issue escalates'),
      validate: undefined,
    },
  ],
  [
    DataConditionType.NEW_HIGH_PRIORITY_ISSUE,
    {
      label: t('Sentry marks a new issue as high priority'),
      validate: undefined,
    },
  ],
  [
    DataConditionType.EXISTING_HIGH_PRIORITY_ISSUE,
    {
      label: t('Sentry marks an existing issue as high priority'),
      validate: undefined,
    },
  ],
  [
    DataConditionType.SEER_ACTIVITY_TRIGGER,
    {
      label: t('Seer runs on an issue and reaches the stage...'),
      dataCondition: SeerActivityTriggerNode,
      details: SeerActivityTriggerDetails,
      defaultComparison: ['pr_ready_for_review'],
      validate: validateSeerActivityTriggerCondition,
    },
  ],
  [
    DataConditionType.AGE_COMPARISON,
    {
      label: t('Issue age'),
      dataCondition: AgeComparisonNode,
      details: AgeComparisonDetails,
      defaultComparison: {
        comparisonType: AgeComparison.OLDER,
        value: 10,
        time: TimeUnit.MINUTES,
      },
      validate: validateAgeComparisonCondition,
    },
  ],
  [
    DataConditionType.ASSIGNED_TO,
    {
      label: t('Issue assignment'),
      dataCondition: AssignedToNode,
      details: AssignedToDetails,
      defaultComparison: {targetType: TargetType.UNASSIGNED},
      validate: validateAssignedToCondition,
    },
  ],
  [
    DataConditionType.ISSUE_OCCURRENCES,
    {
      label: t('Issue frequency'),
      dataCondition: IssueOccurrencesNode,
      details: IssueOccurrencesDetails,
      defaultComparison: {value: 10},
      validate: validateIssueOccurrencesCondition,
    },
  ],
  [
    DataConditionType.ISSUE_CATEGORY,
    {
      label: t('Issue category'),
      dataCondition: IssueCategoryNode,
      details: IssueCategoryDetails,
      validate: validateIssueCategoryCondition,
    },
  ],
  [
    DataConditionType.ISSUE_TYPE,
    {
      label: t('Issue type'),
      dataCondition: IssueTypeNode,
      details: IssueTypeDetails,
      validate: validateIssueTypeCondition,
    },
  ],
  [
    DataConditionType.ISSUE_PRIORITY_GREATER_OR_EQUAL,
    {
      label: t('Issue priority'),
      dataCondition: IssuePriorityNode,
      details: IssuePriorityDetails,
      defaultComparison: Priority.HIGH,
      validate: validateIssuePriorityCondition,
    },
  ],
  [
    DataConditionType.ISSUE_PRIORITY_DEESCALATING,
    {
      label: t('De-escalation'),
      dataCondition: IssuePriorityDeescalating,
      details: IssuePriorityDeescalating,
      defaultComparison: Priority.HIGH,
      validate: undefined,
    },
  ],
  [
    DataConditionType.LATEST_ADOPTED_RELEASE,
    {
      label: t('Release age'),
      dataCondition: LatestAdoptedReleaseNode,
      details: LatestAdoptedReleaseDetails,
      defaultComparison: {
        releaseAgeType: ModelAge.OLDEST,
        ageComparison: AgeComparison.OLDER,
        environment: '',
      },
      validate: validateLatestAdoptedReleaseCondition,
      warningMessage: OccurenceBasedMonitorsWarning,
    },
  ],
  [
    DataConditionType.LATEST_RELEASE,
    {
      label: t('Latest release'),
      dataCondition: LatestReleaseNode,
      details: LatestReleaseNode,
      validate: undefined,
      warningMessage: OccurenceBasedMonitorsWarning,
    },
  ],
  [
    DataConditionType.EVENT_ATTRIBUTE,
    {
      label: t('Event attribute'),
      dataCondition: EventAttributeNode,
      details: EventAttributeDetails,
      defaultComparison: {
        attribute: Attribute.MESSAGE,
        match: MatchType.CONTAINS,
      },
      validate: validateEventAttributeCondition,
      warningMessage: OccurenceBasedMonitorsWarning,
    },
  ],
  [
    DataConditionType.TAGGED_EVENT,
    {
      label: t('Tagged event'),
      dataCondition: TaggedEventNode,
      details: TaggedEventDetails,
      defaultComparison: {
        match: MatchType.CONTAINS,
      },
      validate: validateTaggedEventCondition,
    },
  ],
  [
    DataConditionType.LEVEL,
    {
      label: t('Event level'),
      dataCondition: LevelNode,
      details: LevelDetails,
      defaultComparison: {match: MatchType.EQUAL, level: Level.FATAL},
      validate: validateLevelCondition,
    },
  ],
  [
    DataConditionType.EVENT_FREQUENCY,
    {
      label: t('Number of events'),
      dataCondition: EventFrequencyNode,
      validate: validateEventFrequencyCondition,
      warningMessage: OccurenceBasedMonitorsWarning,
    },
  ],
  [
    DataConditionType.EVENT_FREQUENCY_COUNT,
    {
      label: t('Number of events'),
      dataCondition: EventFrequencyNode,
      details: EventFrequencyCountDetails,
      defaultComparison: {value: 100, interval: Interval.ONE_HOUR},
      validate: validateEventFrequencyCondition,
      warningMessage: OccurenceBasedMonitorsWarning,
    },
  ],
  [
    DataConditionType.EVENT_FREQUENCY_PERCENT,
    {
      label: t('Number of events'),
      dataCondition: EventFrequencyNode,
      details: EventFrequencyPercentDetails,
      defaultComparison: {
        value: 100,
        interval: Interval.ONE_HOUR,
        comparisonInterval: Interval.ONE_WEEK,
      },
      validate: validateEventFrequencyCondition,
      warningMessage: OccurenceBasedMonitorsWarning,
    },
  ],
  [
    DataConditionType.EVENT_UNIQUE_USER_FREQUENCY,
    {
      label: t('Number of users affected'),
      dataCondition: EventUniqueUserFrequencyNode,
      validate: validateEventUniqueUserFrequencyCondition,
      warningMessage: OccurenceBasedMonitorsWarning,
    },
  ],
  [
    DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
    {
      label: t('Number of users affected'),
      dataCondition: EventUniqueUserFrequencyNode,
      details: EventUniqueUserFrequencyCountDetails,
      defaultComparison: {value: 100, interval: Interval.ONE_HOUR},
      validate: validateEventUniqueUserFrequencyCondition,
      warningMessage: OccurenceBasedMonitorsWarning,
    },
  ],
  [
    DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_PERCENT,
    {
      label: t('Number of users affected'),
      dataCondition: EventUniqueUserFrequencyNode,
      details: EventUniqueUserFrequencyPercentDetails,
      defaultComparison: {
        value: 100,
        interval: Interval.ONE_HOUR,
        comparisonInterval: Interval.ONE_WEEK,
      },
      validate: validateEventUniqueUserFrequencyCondition,
      warningMessage: OccurenceBasedMonitorsWarning,
    },
  ],
  [
    DataConditionType.PERCENT_SESSIONS,
    {
      label: t('Percentage of sessions affected'),
      dataCondition: PercentSessionsNode,
      validate: validatePercentSessionsCondition,
      warningMessage: OccurenceBasedMonitorsWarning,
    },
  ],
  [
    DataConditionType.PERCENT_SESSIONS_COUNT,
    {
      label: t('Percentage of sessions affected'),
      dataCondition: PercentSessionsNode,
      details: PercentSessionsCountDetails,
      defaultComparison: {value: 100, interval: Interval.ONE_HOUR},
      validate: validatePercentSessionsCondition,
      warningMessage: OccurenceBasedMonitorsWarning,
    },
  ],
  [
    DataConditionType.PERCENT_SESSIONS_PERCENT,
    {
      label: t('Percentage of sessions affected'),
      dataCondition: PercentSessionsNode,
      details: PercentSessionsPercentDetails,
      defaultComparison: {
        value: 100,
        interval: Interval.ONE_HOUR,
        comparisonInterval: Interval.ONE_WEEK,
      },
      validate: validatePercentSessionsCondition,
      warningMessage: OccurenceBasedMonitorsWarning,
    },
  ],
]);

function OccurenceBasedMonitorsWarning() {
  return (
    <Stack gap="md">
      <WarningLine>
        {t('These filters will only apply to some of your monitors and triggers.')}
      </WarningLine>
      <WarningLine>
        {t(
          'They are only available for occurrence-based monitors (errors, N+1, and replay) and only apply to the triggers "A new event is captured for an issue" and "A new issue is created."'
        )}
      </WarningLine>
    </Stack>
  );
}

const WarningLine = styled('p')`
  margin: 0;
`;
