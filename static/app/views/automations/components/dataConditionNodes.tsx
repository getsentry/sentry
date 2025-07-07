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
} from 'sentry/views/automations/components/actionFilters/ageComparison';
import {
  AssignedToDetails,
  AssignedToNode,
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
} from 'sentry/views/automations/components/actionFilters/eventAttribute';
import {
  EventFrequencyCountDetails,
  EventFrequencyNode,
  EventFrequencyPercentDetails,
} from 'sentry/views/automations/components/actionFilters/eventFrequency';
import {
  EventUniqueUserFrequencyCountDetails,
  EventUniqueUserFrequencyNode,
  EventUniqueUserFrequencyPercentDetails,
} from 'sentry/views/automations/components/actionFilters/eventUniqueUserFrequency';
import {
  IssueCategoryDetails,
  IssueCategoryNode,
} from 'sentry/views/automations/components/actionFilters/issueCategory';
import {
  IssueOccurrencesDetails,
  IssueOccurrencesNode,
} from 'sentry/views/automations/components/actionFilters/issueOccurrences';
import {
  IssuePriorityDetails,
  IssuePriorityNode,
} from 'sentry/views/automations/components/actionFilters/issuePriority';
import {
  LatestAdoptedReleaseDetails,
  LatestAdoptedReleaseNode,
} from 'sentry/views/automations/components/actionFilters/latestAdoptedRelease';
import {LatestReleaseNode} from 'sentry/views/automations/components/actionFilters/latestRelease';
import {
  LevelDetails,
  LevelNode,
} from 'sentry/views/automations/components/actionFilters/level';
import {
  PercentSessionsCountDetails,
  PercentSessionsNode,
  PercentSessionsPercentDetails,
} from 'sentry/views/automations/components/actionFilters/percentSessions';
import {
  TaggedEventDetails,
  TaggedEventNode,
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
  dataCondition?: React.ComponentType<any>;
  defaultComparison?: any;
  details?: React.ComponentType<any>;
};

export const dataConditionNodesMap = new Map<DataConditionType, DataConditionNode>([
  [
    DataConditionType.FIRST_SEEN_EVENT,
    {
      label: t('A new issue is created'),
    },
  ],
  [
    DataConditionType.REGRESSION_EVENT,
    {
      label: t('A resolved issue becomes unresolved'),
    },
  ],
  [
    DataConditionType.REAPPEARED_EVENT,
    {
      label: t('An issue escalates'),
    },
  ],
  [
    DataConditionType.NEW_HIGH_PRIORITY_ISSUE,
    {
      label: t('Sentry marks a new issue as high priority'),
    },
  ],
  [
    DataConditionType.EXISTING_HIGH_PRIORITY_ISSUE,
    {
      label: t('Sentry marks an existing issue as high priority'),
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
        time: TimeUnit.MINUTES,
      },
    },
  ],
  [
    DataConditionType.ASSIGNED_TO,
    {
      label: t('Issue assignment'),
      dataCondition: AssignedToNode,
      details: AssignedToDetails,
      defaultComparison: {targetType: TargetType.UNASSIGNED},
    },
  ],
  [
    DataConditionType.ISSUE_OCCURRENCES,
    {
      label: t('Issue frequency'),
      dataCondition: IssueOccurrencesNode,
      details: IssueOccurrencesDetails,
    },
  ],
  [
    DataConditionType.ISSUE_CATEGORY,
    {
      label: t('Issue category'),
      dataCondition: IssueCategoryNode,
      details: IssueCategoryDetails,
    },
  ],
  [
    DataConditionType.ISSUE_PRIORITY_GREATER_OR_EQUAL,
    {
      label: t('Issue priority'),
      dataCondition: IssuePriorityNode,
      details: IssuePriorityDetails,
      defaultComparison: Priority.HIGH,
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
    },
  ],
  [
    DataConditionType.LATEST_RELEASE,
    {
      label: t('Latest release'),
      dataCondition: LatestReleaseNode,
      details: LatestReleaseNode,
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
    },
  ],
  [
    DataConditionType.LEVEL,
    {
      label: t('Event level'),
      dataCondition: LevelNode,
      details: LevelDetails,
      defaultComparison: {match: MatchType.EQUAL, level: Level.FATAL},
    },
  ],
  [
    DataConditionType.EVENT_FREQUENCY,
    {
      label: t('Number of events'),
      dataCondition: EventFrequencyNode,
    },
  ],
  [
    DataConditionType.EVENT_FREQUENCY_COUNT,
    {
      label: t('Number of events'),
      dataCondition: EventFrequencyNode,
      details: EventFrequencyCountDetails,
      defaultComparison: {interval: Interval.ONE_HOUR},
    },
  ],
  [
    DataConditionType.EVENT_FREQUENCY_PERCENT,
    {
      label: t('Number of events'),
      dataCondition: EventFrequencyNode,
      details: EventFrequencyPercentDetails,
      defaultComparison: {
        interval: Interval.ONE_HOUR,
        comparison_interval: Interval.ONE_WEEK,
      },
    },
  ],
  [
    DataConditionType.EVENT_UNIQUE_USER_FREQUENCY,
    {
      label: t('Number of users affected'),
      dataCondition: EventUniqueUserFrequencyNode,
    },
  ],
  [
    DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
    {
      label: t('Number of users affected'),
      dataCondition: EventUniqueUserFrequencyNode,
      details: EventUniqueUserFrequencyCountDetails,
      defaultComparison: {interval: Interval.ONE_HOUR},
    },
  ],
  [
    DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_PERCENT,
    {
      label: t('Number of users affected'),
      dataCondition: EventUniqueUserFrequencyNode,
      details: EventUniqueUserFrequencyPercentDetails,
      defaultComparison: {
        interval: Interval.ONE_HOUR,
        comparison_interval: Interval.ONE_WEEK,
      },
    },
  ],
  [
    DataConditionType.PERCENT_SESSIONS,
    {
      label: t('Percentage of sessions affected'),
      dataCondition: PercentSessionsNode,
    },
  ],
  [
    DataConditionType.PERCENT_SESSIONS_COUNT,
    {
      label: t('Percentage of sessions affected'),
      dataCondition: PercentSessionsNode,
      details: PercentSessionsCountDetails,
      defaultComparison: {interval: Interval.ONE_HOUR},
    },
  ],
  [
    DataConditionType.PERCENT_SESSIONS_PERCENT,
    {
      label: t('Percentage of sessions affected'),
      dataCondition: PercentSessionsNode,
      details: PercentSessionsPercentDetails,
      defaultComparison: {
        interval: Interval.ONE_HOUR,
        comparison_interval: Interval.ONE_WEEK,
      },
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
