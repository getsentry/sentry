import {createContext, useContext} from 'react';

import {t} from 'sentry/locale';
import {
  type DataCondition,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';
import AgeComparisonNode from 'sentry/views/automations/components/actionFilters/ageComparison';
import {AssignedToNode} from 'sentry/views/automations/components/actionFilters/assignedTo';
import EventAttributeNode from 'sentry/views/automations/components/actionFilters/eventAttribute';
import EventFrequencyNode from 'sentry/views/automations/components/actionFilters/eventFrequency';
import EventUniqueUserFrequencyNode from 'sentry/views/automations/components/actionFilters/eventUniqueUserFrequency';
import IssueOccurrencesNode from 'sentry/views/automations/components/actionFilters/issueOccurrences';
import IssuePriorityNode from 'sentry/views/automations/components/actionFilters/issuePriority';
import LatestAdoptedReleaseNode from 'sentry/views/automations/components/actionFilters/latestAdoptedRelease';
import LevelNode from 'sentry/views/automations/components/actionFilters/level';
import PercentSessionsNode from 'sentry/views/automations/components/actionFilters/percentSessions';
import TaggedEventNode from 'sentry/views/automations/components/actionFilters/taggedEvent';

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
    DataConditionType.AGE_COMPARISON,
    {
      label: t('Issue age'),
      dataCondition: <AgeComparisonNode />,
    },
  ],
  [
    DataConditionType.ASSIGNED_TO,
    {
      label: t('Issue assignment'),
      dataCondition: <AssignedToNode />,
    },
  ],
  [
    DataConditionType.ISSUE_OCCURRENCES,
    {
      label: t('Issue frequency'),
      dataCondition: <IssueOccurrencesNode />,
    },
  ],
  [
    DataConditionType.ISSUE_PRIORITY_EQUALS,
    {
      label: t('Issue priority'),
      dataCondition: <IssuePriorityNode />,
    },
  ],
  [
    DataConditionType.LATEST_ADOPTED_RELEASE,
    {
      label: t('Release age'),
      dataCondition: <LatestAdoptedReleaseNode />,
    },
  ],
  [
    DataConditionType.LATEST_RELEASE,
    {
      label: t('Latest release'),
      dataCondition: t('The issue is from the latest release'),
    },
  ],
  [
    DataConditionType.EVENT_ATTRIBUTE,
    {
      label: t('Event attribute'),
      dataCondition: <EventAttributeNode />,
    },
  ],
  [
    DataConditionType.TAGGED_EVENT,
    {
      label: t('Tagged event'),
      dataCondition: <TaggedEventNode />,
    },
  ],
  [
    DataConditionType.LEVEL,
    {
      label: t('Event level'),
      dataCondition: <LevelNode />,
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
    },
  ],
  [
    DataConditionType.EVENT_FREQUENCY_PERCENT,
    {
      label: t('Number of events'),
      dataCondition: <EventFrequencyNode />,
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
    },
  ],
  [
    DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_PERCENT,
    {
      label: t('Number of users affected'),
      dataCondition: <EventUniqueUserFrequencyNode />,
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
    },
  ],
  [
    DataConditionType.PERCENT_SESSIONS_PERCENT,
    {
      label: t('Percentage of sessions affected'),
      dataCondition: <PercentSessionsNode />,
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
