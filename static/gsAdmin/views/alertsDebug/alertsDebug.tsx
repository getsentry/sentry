import {useRef, useState} from 'react';

import {Input} from '@sentry/scraps/input';
import {Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Heading} from '@sentry/scraps/text';

import type {Automation} from 'sentry/types/workflowEngine/automations';

import PageHeader from 'admin/components/pageHeader';
import {AlertDebugForm} from 'admin/views/alertsDebug/components/alertDebugForm';
import {AlertDebugResults} from 'admin/views/alertsDebug/components/alertDebugResults';
import {AlertDetails} from 'admin/views/alertsDebug/components/alertDetails';
import {MOCK_WORKFLOW} from 'admin/views/alertsDebug/fixtures';
import type {AlertDebugFormData} from 'admin/views/alertsDebug/types';

export function AlertsDebug() {
  const [results, setResults] = useState<AlertDebugFormData>();
  const workflowRef = useRef<HTMLInputElement>(null);
  const [workflowId, setWorkflowId] = useState<number>();
  const [workflow, setWorkflow] = useState<Automation>();

  const updateApi = (data: AlertDebugFormData) => {
    setResults(data);
  };

  const getAlert = (e: React.FormEvent) => {
    e.preventDefault();

    if (workflowRef.current) {
      const currentWorkflowId = workflowRef.current.value;
      setWorkflowId(Number(currentWorkflowId));
      setWorkflow({...MOCK_WORKFLOW, id: currentWorkflowId});
    }
  };

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

      {workflow && (
        <Stack gap="lg">
          <AlertDetails workflow={workflow} />
          <Separator orientation="horizontal" />
          <Heading as="h2">History</Heading>
          <Separator orientation="horizontal" />
        </Stack>
      )}

      {workflowId && <AlertDebugForm onSubmit={updateApi} workflowId={workflowId} />}
      {results && <AlertDebugResults results={results} />}
    </Stack>
  );
}

export default AlertsDebug;
