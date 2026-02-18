import {useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';

import LoadingIndicator from 'sentry/components/loadingIndicator';

import PageHeader from 'admin/components/pageHeader';
import {AlertDebugForm} from 'admin/views/alertsDebug/components/alertDebugForm';
import {AlertDebugResults} from 'admin/views/alertsDebug/components/alertDebugResults';
import {AlertDetails} from 'admin/views/alertsDebug/components/alertDetails';
import {MOCK_WORKFLOW} from 'admin/views/alertsDebug/fixtures';
import {useAdminWorkflow} from 'admin/views/alertsDebug/hooks/useAdminWorkflow';
import type {WorkflowEventDebugFormData} from 'admin/views/alertsDebug/types';

type Step = 'workflow' | 'selection' | 'results';

export function AlertsDebug() {
  const [step, setStep] = useState<Step>('workflow');
  const [workflowId, setWorkflowId] = useState<number>();
  const [results, setResults] = useState<WorkflowEventDebugFormData>();

  const {
    data: asyncWorkflow,
    isPending,
    isError,
  } = useAdminWorkflow(workflowId?.toString());

  // Use mock workflow if there's an error fetching (for dev purposes)
  const workflow = isError ? MOCK_WORKFLOW : asyncWorkflow;

  const workflowForm = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {workflowId: undefined as number | undefined},
    onSubmit: ({value}) => {
      if (value.workflowId !== undefined && value.workflowId > 0) {
        setWorkflowId(value.workflowId);
        setStep('selection');
      }
    },
  });

  const handleSelectionSubmit = (data: WorkflowEventDebugFormData) => {
    setResults(data);
    setStep('results');
  };

  const handleBack = () => {
    if (step === 'selection') {
      setStep('workflow');
    } else if (step === 'results') {
      setStep('selection');
    }
  };

  const handleReset = () => {
    setStep('workflow');
    setWorkflowId(undefined);
    setResults(undefined);
    workflowForm.reset();
  };

  return (
    <Stack gap="lg">
      <PageHeader title="Alerts Debug" />

      {step === 'workflow' && (
        <workflowForm.AppForm>
          <workflowForm.FormWrapper>
            <Stack gap="md">
              <Heading as="h2">Enter Workflow ID</Heading>

              <workflowForm.AppField name="workflowId">
                {field => (
                  <field.Input
                    type="number"
                    value={field.state.value?.toString() ?? ''}
                    onChange={value => {
                      const num = parseInt(value, 10);
                      field.handleChange(Number.isNaN(num) ? undefined : num);
                    }}
                    placeholder="Workflow ID"
                    required
                  />
                )}
              </workflowForm.AppField>

              <Flex justify="end">
                <workflowForm.SubmitButton>Continue</workflowForm.SubmitButton>
              </Flex>
            </Stack>
          </workflowForm.FormWrapper>
        </workflowForm.AppForm>
      )}

      {step === 'selection' && workflowId && (
        <Stack gap="lg">
          {isPending && <LoadingIndicator />}

          {isError && (
            <Text variant="danger">
              Error loading workflow. Using mock data for debugging.
            </Text>
          )}

          {workflow && (
            <Stack gap="lg">
              <AlertDetails workflow={workflow} />
              <Separator orientation="horizontal" />
            </Stack>
          )}

          <AlertDebugForm
            workflowId={workflowId}
            onSubmit={handleSelectionSubmit}
            onBack={handleBack}
          />
        </Stack>
      )}

      {step === 'results' && results && (
        <Stack gap="lg">
          <AlertDebugResults results={results} />

          <Flex gap="md" justify="end">
            <Button onClick={handleBack}>Back</Button>
            <Button priority="primary" onClick={handleReset}>
              Start Over
            </Button>
          </Flex>
        </Stack>
      )}
    </Stack>
  );
}

export default AlertsDebug;
