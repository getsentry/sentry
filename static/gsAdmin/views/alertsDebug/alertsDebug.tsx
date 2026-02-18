import {useRef, useState} from 'react';

import {Input} from '@sentry/scraps/input';
import {Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {
  DataConditionGroupLogicType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';

import PageHeader from 'admin/components/pageHeader';
import {AlertDebugForm} from 'admin/views/alertsDebug/components/alertDebugForm';
import {AlertDebugResults} from 'admin/views/alertsDebug/components/alertDebugResults';
import {AlertDetails} from 'admin/views/alertsDebug/components/alertDetails';
import {useAdminWorkflow} from 'admin/views/alertsDebug/hooks/useAdminWorkflow';
import type {AlertDebugFormData} from 'admin/views/alertsDebug/types';

const defaultWorkflow: Automation = {
  id: '1234',
  name: 'Mock Alert',
  createdBy: 'Josh',
  dateCreated: Date.now().toLocaleString(),
  dateUpdated: Date.now().toLocaleString(),
  lastTriggered: Date.now().toLocaleString(),
  config: {
    frequency: 10,
  },
  detectorIds: ['33', '732', '8'],
  enabled: true,
  environment: 'DEBUGGING -- TEST FIXTURE',
  actionFilters: [
    {
      id: 'mock-action-filter',
      logicType: DataConditionGroupLogicType.ANY,
      conditions: [
        {
          id: 'Condition 1',
          comparison: 10,
          type: DataConditionType.EVENT_FREQUENCY_COUNT,
          conditionResult: true,
        },
        {
          id: 'Condition 2',
          comparison: 100,
          type: DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
          conditionResult: true,
        },
      ],
    },
    {
      id: 'mock-action-filter',
      logicType: DataConditionGroupLogicType.ANY,
      conditions: [
        {
          id: 'Condition 1',
          comparison: 10,
          type: DataConditionType.EVENT_FREQUENCY_COUNT,
          conditionResult: true,
        },
        {
          id: 'Condition 2',
          comparison: 100,
          type: DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
          conditionResult: true,
        },
      ],
    },
  ],
  triggers: {
    id: 'mock-data-condition-group',
    logicType: DataConditionGroupLogicType.ANY,
    conditions: [
      {
        id: 'mock-data-condition',
        comparison: 'comparison',
        type: DataConditionType.GREATER_OR_EQUAL,
        conditionResult: 75,
      },
    ],
  },
};

export function AlertsDebug() {
  const [results, setResults] = useState<AlertDebugFormData>();
  const workflowRef = useRef<HTMLInputElement>(null);
  const [workflowId, setWorkflowId] = useState<string>();

  const {data: asyncWorkflow, isPending, isError} = useAdminWorkflow(workflowId);
  let useDefaultWorkflow = false;

  const updateApi = (data: AlertDebugFormData) => {
    setResults(data);
  };

  const getAlert = (e: React.FormEvent) => {
    e.preventDefault();

    if (workflowRef.current?.value) {
      setWorkflowId(workflowRef.current.value);
    }
  };

  if (workflowId && isError) {
    useDefaultWorkflow = true;
  }

  const workflow = useDefaultWorkflow && !asyncWorkflow ? defaultWorkflow : asyncWorkflow;

  return (
    <Stack gap="lg">
      <PageHeader title="Alerts Debug" />

      <form onSubmit={getAlert}>
        <Input
          name="workflowId"
          type="number"
          placeholder="Alert ID"
          onBlur={getAlert}
          ref={workflowRef}
        />
      </form>

      {workflowId && isPending && <LoadingIndicator />}

      {workflowId && isError && (
        <Text variant="danger">
          Error loading workflow. Please check the ID and try again.
        </Text>
      )}

      {workflow && (
        <Stack gap="lg">
          <AlertDetails workflow={workflow} />
          <Separator orientation="horizontal" />
          <Heading as="h2">History</Heading>
          <Separator orientation="horizontal" />
        </Stack>
      )}

      {workflowId && workflow && (
        <AlertDebugForm onSubmit={updateApi} workflowId={Number(workflowId)} />
      )}
      {results && <AlertDebugResults results={results} />}
    </Stack>
  );
}

export default AlertsDebug;
