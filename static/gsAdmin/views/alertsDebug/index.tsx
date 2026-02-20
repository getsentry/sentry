import {useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';

import LoadingIndicator from 'sentry/components/loadingIndicator';

import PageHeader from 'admin/components/pageHeader';
import {AlertDebugForm} from 'admin/views/alertsDebug/components/alertDebugForm';
import {AlertDetails} from 'admin/views/alertsDebug/components/alertDetails';
import {WorkflowLogs} from 'admin/views/alertsDebug/components/workflowLogs';
import {MOCK_WORKFLOW} from 'admin/views/alertsDebug/fixtures';
import {useAdminWorkflow} from 'admin/views/alertsDebug/hooks/useAdminWorkflow';

/**
 * Alerts Debug Page
 *
 * Progressive UX flow:
 * 1. Enter organization slug/ID and workflow ID
 * 2. Workflow details appear when loaded
 * 3. Event input appears when workflow is ready
 * 4. Event cards display as events are added
 * 5. Results display inline after clicking "Evaluate Events"
 */
export default function AlertsDebug() {
  const [organizationIdOrSlug, setOrganizationIdOrSlug] = useState<string>();
  const [workflowId, setWorkflowId] = useState<number>();

  const {
    data: asyncWorkflow,
    isPending,
    isError,
  } = useAdminWorkflow(organizationIdOrSlug, workflowId?.toString());

  // Use mock workflow if there's an error fetching (for dev purposes)
  const workflow = isError ? MOCK_WORKFLOW : asyncWorkflow;

  const workflowForm = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      organizationIdOrSlug: undefined as string | undefined,
      workflowId: undefined as number | undefined,
    },
    onSubmit: ({value}) => {
      if (
        value.organizationIdOrSlug &&
        value.workflowId !== undefined &&
        value.workflowId > 0
      ) {
        setOrganizationIdOrSlug(value.organizationIdOrSlug);
        setWorkflowId(value.workflowId);
      }
    },
  });

  const handleChangeWorkflow = () => {
    setOrganizationIdOrSlug(undefined);
    setWorkflowId(undefined);
  };

  return (
    <Stack gap="lg">
      <PageHeader title="Alerts Debug" />

      {/* Phase 1: Organization + Workflow ID Input */}
      {!workflowId && (
        <workflowForm.AppForm>
          <workflowForm.FormWrapper>
            <Stack gap="md">
              <Heading as="h2">Enter Workflow Details</Heading>
              <Text as="p">
                Enter an organization slug or ID and workflow ID to load the workflow
                configuration.
              </Text>

              <workflowForm.AppField name="organizationIdOrSlug">
                {field => (
                  <field.Input
                    type="text"
                    value={field.state.value ?? ''}
                    onChange={value => {
                      field.handleChange(value || undefined);
                    }}
                    placeholder="Organization ID or Slug"
                    required
                  />
                )}
              </workflowForm.AppField>

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
                <workflowForm.SubmitButton>Load Workflow</workflowForm.SubmitButton>
              </Flex>
            </Stack>
          </workflowForm.FormWrapper>
        </workflowForm.AppForm>
      )}

      {/* Phase 2: Workflow Details + Event Selection */}
      {workflowId && (
        <Stack gap="lg">
          {isPending && (
            <Flex alignSelf="center" direction="column">
              <Heading as="h2">Loading Workflow {workflowId}</Heading>
              <LoadingIndicator />
            </Flex>
          )}

          {isError && (
            <Text variant="danger">
              Error loading workflow. Using mock data for debugging.
            </Text>
          )}

          {workflow && (
            <Stack gap="lg">
              <Flex justify="between" align="center">
                <Heading as="h1">Workflow: {workflowId}</Heading>
                <Button size="sm" onClick={handleChangeWorkflow}>
                  Change Workflow
                </Button>
              </Flex>

              <AlertDetails workflow={workflow} />
              <Separator orientation="horizontal" />

              <WorkflowLogs
                workflowId={workflowId}
                organizationId={workflow.organizationId}
              />
              <Separator orientation="horizontal" />

              <AlertDebugForm workflowId={workflowId} />
            </Stack>
          )}
        </Stack>
      )}
    </Stack>
  );
}
