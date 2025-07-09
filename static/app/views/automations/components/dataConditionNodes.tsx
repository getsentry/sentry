import type React from 'react';
import {createContext, useContext} from 'react';

import {t} from 'sentry/locale';
import {
  type DataCondition,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';
import {
  AgeComparisonDetails,
  AgeComparisonNode,
  validateAgeComparisonCondition,
} from 'sentry/views/automations/components/actionFilters/ageComparison';
import {
  AssignedToDetails,
  AssignedToNode,
  validateAssignedToCondition,
} from 'sentry/views/automations/components/actionFilters/assignedTo';
import {
  AgeComparison,
  Attributes,
  Interval,
  Level,
  MatchType,
  ModelAge,
  Priority,
  TargetType,
  TimeUnit,
} from 'sentry/views/automations/components/actionFilters/constants';
import {
  EventAttributeDetails,
  EventAttributeNode,
  validateEventAttributeCondition,
} from 'sentry/views/automations/components/actionFilters/eventAttribute';
import {
  EventFrequencyCountDetails,
  EventFrequencyNode,
  EventFrequencyPercentDetails,
  validateEventFrequencyCondition,
} from 'sentry/views/automations/components/actionFilters/eventFrequency';
import {
  EventUniqueUserFrequencyCountDetails,
  EventUniqueUserFrequencyNode,
  EventUniqueUserFrequencyPercentDetails,
  validateEventUniqueUserFrequencyCondition,
} from 'sentry/views/automations/components/actionFilters/eventUniqueUserFrequency';
import {
  IssueCategoryDetails,
  IssueCategoryNode,
  validateIssueCategoryCondition,
} from 'sentry/views/automations/components/actionFilters/issueCategory';
import {
  IssueOccurrencesDetails,
  IssueOccurrencesNode,
  validateIssueOccurrencesCondition,
} from 'sentry/views/automations/components/actionFilters/issueOccurrences';
import {
  IssuePriorityDetails,
  IssuePriorityNode,
  validateIssuePriorityCondition,
} from 'sentry/views/automations/components/actionFilters/issuePriority';
import {
  LatestAdoptedReleaseDetails,
  LatestAdoptedReleaseNode,
  validateLatestAdoptedReleaseCondition,
} from 'sentry/views/automations/components/actionFilters/latestAdoptedRelease';
import {LatestReleaseNode} from 'sentry/views/automations/components/actionFilters/latestRelease';
import {
  LevelDetails,
  LevelNode,
  validateLevelCondition,
} from 'sentry/views/automations/components/actionFilters/level';
import {
  PercentSessionsCountDetails,
  PercentSessionsNode,
  PercentSessionsPercentDetails,
  validatePercentSessionsCondition,
} from 'sentry/views/automations/components/actionFilters/percentSessions';
import {
  TaggedEventDetails,
  TaggedEventNode,
  validateTaggedEventCondition,
} from 'sentry/views/automations/components/actionFilters/taggedEvent';

interface DataConditionNodeProps {
  condition: DataCondition;
  condition_id: string;
  onUpdate: (params: {comparison?: any; type?: DataConditionType}) => void;
}

export const DataConditionNodeContext = createContext<DataConditionNodeProps | null>(
  null
);

export function useDataConditionNodeContext(): DataConditionNodeProps {
  const context = useContext(DataConditionNodeContext);
  if (!context) {
    throw new Error(
      'useDataConditionNodeContext was called outside of DataConditionNode'
    );
  }
  return context;
}

type DataConditionNode = {
  label: string;
  validate: ((condition: DataCondition) => string | undefined) | undefined;
  dataCondition?: React.ComponentType<any>;
  defaultComparison?: any;
  details?: React.ComponentType<any>;
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
    DataConditionType.REGRESSION_EVENT,
    {
      label: t('A resolved issue becomes unresolved'),
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
    DataConditionType.AGE_COMPARISON,
    {
      label: t('Issue age'),
      dataCondition: AgeComparisonNode,
      details: AgeComparisonDetails,
      defaultComparison: {
        comparison_type: AgeComparison.OLDER,
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
    DataConditionType.LATEST_ADOPTED_RELEASE,
    {
      label: t('Release age'),
      dataCondition: LatestAdoptedReleaseNode,
      details: LatestAdoptedReleaseDetails,
      defaultComparison: {
        release_age_type: ModelAge.OLDEST,
        age_comparison: AgeComparison.OLDER,
        environment: '',
      },
      validate: validateLatestAdoptedReleaseCondition,
    },
  ],
  [
    DataConditionType.LATEST_RELEASE,
    {
      label: t('Latest release'),
      dataCondition: LatestReleaseNode,
      details: LatestReleaseNode,
      validate: undefined,
    },
  ],
  [
    DataConditionType.EVENT_ATTRIBUTE,
    {
      label: t('Event attribute'),
      dataCondition: EventAttributeNode,
      details: EventAttributeDetails,
      defaultComparison: {
        attribute: Attributes.MESSAGE,
        match: MatchType.CONTAINS,
      },
      validate: validateEventAttributeCondition,
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
        comparison_interval: Interval.ONE_WEEK,
      },
      validate: validateEventFrequencyCondition,
    },
  ],
  [
    DataConditionType.EVENT_UNIQUE_USER_FREQUENCY,
    {
      label: t('Number of users affected'),
      dataCondition: EventUniqueUserFrequencyNode,
      validate: validateEventUniqueUserFrequencyCondition,
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
        comparison_interval: Interval.ONE_WEEK,
      },
      validate: validateEventUniqueUserFrequencyCondition,
    },
  ],
  [
    DataConditionType.PERCENT_SESSIONS,
    {
      label: t('Percentage of sessions affected'),
      dataCondition: PercentSessionsNode,
      validate: validatePercentSessionsCondition,
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
        comparison_interval: Interval.ONE_WEEK,
      },
      validate: validatePercentSessionsCondition,
    },
  ],
]);

export const frequencyTypeMapping: Partial<Record<DataConditionType, DataConditionType>> =
  {
    [DataConditionType.PERCENT_SESSIONS_COUNT]: DataConditionType.PERCENT_SESSIONS,
    [DataConditionType.PERCENT_SESSIONS_PERCENT]: DataConditionType.PERCENT_SESSIONS,
    [DataConditionType.EVENT_FREQUENCY_COUNT]: DataConditionType.EVENT_FREQUENCY,
    [DataConditionType.EVENT_FREQUENCY_PERCENT]: DataConditionType.EVENT_FREQUENCY,
    [DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_COUNT]:
      DataConditionType.EVENT_UNIQUE_USER_FREQUENCY,
    [DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_PERCENT]:
      DataConditionType.EVENT_UNIQUE_USER_FREQUENCY,
  };
