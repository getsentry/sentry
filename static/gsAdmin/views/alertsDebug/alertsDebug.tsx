import {useRef, useState} from 'react';

import {Input} from '@sentry/scraps/input';
import {Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';

import LoadingIndicator from 'sentry/components/loadingIndicator';

import PageHeader from 'admin/components/pageHeader';
import {AlertDebugForm} from 'admin/views/alertsDebug/components/alertDebugForm';
import {AlertDebugResults} from 'admin/views/alertsDebug/components/alertDebugResults';
import {AlertDetails} from 'admin/views/alertsDebug/components/alertDetails';
import {useAdminWorkflow} from 'admin/views/alertsDebug/hooks/useAdminWorkflow';
import type {AlertDebugFormData} from 'admin/views/alertsDebug/types';

export function AlertsDebug() {
  const [results, setResults] = useState<AlertDebugFormData>();
  const workflowRef = useRef<HTMLInputElement>(null);
  const [workflowId, setWorkflowId] = useState<string>();

  const {data: workflow, isPending, isError} = useAdminWorkflow(workflowId);

  const updateApi = (data: AlertDebugFormData) => {
    setResults(data);
  };

  const getAlert = (e: React.FormEvent) => {
    e.preventDefault();

    if (workflowRef.current?.value) {
      setWorkflowId(workflowRef.current.value);
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
