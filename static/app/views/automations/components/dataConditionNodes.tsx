import {createContext, useContext} from 'react';

import {t} from 'sentry/locale';
import {
  type DataCondition,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';
import AgeComparisonNode, {
  AgeComparisonDetails,
} from 'sentry/views/automations/components/actionFilters/ageComparison';
import {
  AssignedToDetails,
  AssignedToNode,
} from 'sentry/views/automations/components/actionFilters/assignedTo';
import EventAttributeNode, {
  EventAttributeDetails,
} from 'sentry/views/automations/components/actionFilters/eventAttribute';
import EventFrequencyNode, {
  EventFrequencyCountDetails,
  EventFrequencyPercentDetails,
} from 'sentry/views/automations/components/actionFilters/eventFrequency';
import EventUniqueUserFrequencyNode, {
  EventUniqueUserFrequencyCountDetails,
  EventUniqueUserFrequencyPercentDetails,
} from 'sentry/views/automations/components/actionFilters/eventUniqueUserFrequency';
import IssueOccurrencesNode, {
  IssueOccurrencesDetails,
} from 'sentry/views/automations/components/actionFilters/issueOccurrences';
import IssuePriorityNode, {
  IssuePriorityDetails,
} from 'sentry/views/automations/components/actionFilters/issuePriority';
import LatestAdoptedReleaseNode, {
  LatestAdoptedReleaseDetails,
} from 'sentry/views/automations/components/actionFilters/latestAdoptedRelease';
import {LatestReleaseNode} from 'sentry/views/automations/components/actionFilters/latestRelease';
import LevelNode, {
  LevelDetails,
} from 'sentry/views/automations/components/actionFilters/level';
import PercentSessionsNode, {
  PercentSessionsCountDetails,
  PercentSessionsPercentDetails,
} from 'sentry/views/automations/components/actionFilters/percentSessions';
import TaggedEventNode, {
  TaggedEventDetails,
} from 'sentry/views/automations/components/actionFilters/taggedEvent';

interface DataConditionNodeProps {
  condition: DataCondition;
  condition_id: string;
  onUpdate: (comparison: Record<string, any>) => void;
  onUpdateType: (type: DataConditionType) => void;
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
  dataCondition?: React.ReactNode;
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
      dataCondition: <AgeComparisonNode />,
      details: AgeComparisonDetails,
    },
  ],
  [
    DataConditionType.ASSIGNED_TO,
    {
      label: t('Issue assignment'),
      dataCondition: <AssignedToNode />,
      details: AssignedToDetails,
    },
  ],
  [
    DataConditionType.ISSUE_OCCURRENCES,
    {
      label: t('Issue frequency'),
      dataCondition: <IssueOccurrencesNode />,
      details: IssueOccurrencesDetails,
    },
  ],
  [
    DataConditionType.ISSUE_PRIORITY_EQUALS,
    {
      label: t('Issue priority'),
      dataCondition: <IssuePriorityNode />,
      details: IssuePriorityDetails,
    },
  ],
  [
    DataConditionType.LATEST_ADOPTED_RELEASE,
    {
      label: t('Release age'),
      dataCondition: <LatestAdoptedReleaseNode />,
      details: LatestAdoptedReleaseDetails,
    },
  ],
  [
    DataConditionType.LATEST_RELEASE,
    {
      label: t('Latest release'),
      dataCondition: <LatestReleaseNode />,
      details: LatestReleaseNode,
    },
  ],
  [
    DataConditionType.EVENT_ATTRIBUTE,
    {
      label: t('Event attribute'),
      dataCondition: <EventAttributeNode />,
      details: EventAttributeDetails,
    },
  ],
  [
    DataConditionType.TAGGED_EVENT,
    {
      label: t('Tagged event'),
      dataCondition: <TaggedEventNode />,
      details: TaggedEventDetails,
    },
  ],
  [
    DataConditionType.LEVEL,
    {
      label: t('Event level'),
      dataCondition: <LevelNode />,
      details: LevelDetails,
    },
  ],
  [
    DataConditionType.EVENT_FREQUENCY,
    {
      label: t('Number of events'),
      dataCondition: <EventFrequencyNode />,
    },
  ],
  [
    DataConditionType.EVENT_FREQUENCY_COUNT,
    {
      label: t('Number of events'),
      dataCondition: <EventFrequencyNode />,
      details: EventFrequencyCountDetails,
    },
  ],
  [
    DataConditionType.EVENT_FREQUENCY_PERCENT,
    {
      label: t('Number of events'),
      dataCondition: <EventFrequencyNode />,
      details: EventFrequencyPercentDetails,
    },
  ],
  [
    DataConditionType.EVENT_UNIQUE_USER_FREQUENCY,
    {
      label: t('Number of users affected'),
      dataCondition: <EventUniqueUserFrequencyNode />,
    },
  ],
  [
    DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
    {
      label: t('Number of users affected'),
      dataCondition: <EventUniqueUserFrequencyNode />,
      details: EventUniqueUserFrequencyCountDetails,
    },
  ],
  [
    DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_PERCENT,
    {
      label: t('Number of users affected'),
      dataCondition: <EventUniqueUserFrequencyNode />,
      details: EventUniqueUserFrequencyPercentDetails,
    },
  ],
  [
    DataConditionType.PERCENT_SESSIONS,
    {
      label: t('Percentage of sessions affected'),
      dataCondition: <PercentSessionsNode />,
    },
  ],
  [
    DataConditionType.PERCENT_SESSIONS_COUNT,
    {
      label: t('Percentage of sessions affected'),
      dataCondition: <PercentSessionsNode />,
      details: PercentSessionsCountDetails,
    },
  ],
  [
    DataConditionType.PERCENT_SESSIONS_PERCENT,
    {
      label: t('Percentage of sessions affected'),
      dataCondition: <PercentSessionsNode />,
      details: PercentSessionsPercentDetails,
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
