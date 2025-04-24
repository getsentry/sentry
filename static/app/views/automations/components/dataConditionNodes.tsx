import {createContext, useContext} from 'react';

import {t} from 'sentry/locale';
import {
  DataConditionType,
  type NewDataCondition,
} from 'sentry/types/workflowEngine/dataConditions';
import AgeComparisonNode from 'sentry/views/automations/components/actionFilters/ageComparison';
import EventAttributeNode from 'sentry/views/automations/components/actionFilters/eventAttribute';
import IssueOccurrencesNode from 'sentry/views/automations/components/actionFilters/issueOccurrences';
import LatestAdoptedReleaseNode from 'sentry/views/automations/components/actionFilters/latestAdoptedRelease';
import TaggedEventNode from 'sentry/views/automations/components/actionFilters/taggedEvent';

interface DataConditionNodeProps {
  condition: NewDataCondition;
  condition_id: string;
  onUpdate: (condition: Record<string, any>) => void;
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
    DataConditionType.ISSUE_OCCURRENCES,
    {
      label: t('Issue frequency'),
      dataCondition: <IssueOccurrencesNode />,
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
]);
