import {Fragment} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {openModal, type ModalRenderProps} from '@sentry/scraps/modal';
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';

const FEATURE_OPTIONS = [
  {value: 'test_paid', label: 'test_paid (billed as Seer credits)'},
  {value: 'test_free', label: 'test_free (free)'},
];
const FEATURES = FEATURE_OPTIONS.map(option => option.value);

const schema = z.object({
  feature: z.string().refine(value => FEATURES.includes(value), 'Select a feature'),
  projectId: z.string().min(1, 'Select a project'),
  costUsd: z
    .number()
    .nullable()
    .refine(
      (value): value is number => value !== null && value > 0,
      'Enter a positive cost'
    ),
  timestamp: z.string(),
  ticketUrl: z.string(),
  notes: z.string().trim().min(1, 'Explain why you are simulating usage').max(500),
});

type SimulatedUsageData = {
  costUsd: number;
  feature: string;
  notes: string;
  projectId: number;
  ticketUrl: string;
  timestamp?: string;
};

interface SimulateLlmUsageModalProps extends ModalRenderProps {
  onSuccess: () => void;
  orgId: string;
}

function SimulateLlmUsageModal({
  orgId,
  onSuccess,
  closeModal,
  Header,
  Body,
  Footer,
}: SimulateLlmUsageModalProps) {
  const {
    data: projects,
    isPending,
    isError,
    refetch,
  } = useQuery(
    apiOptions.as<Project[]>()('/organizations/$organizationIdOrSlug/projects/', {
      path: {organizationIdOrSlug: orgId},
      query: {all_projects: '1'},
      staleTime: 0,
    })
  );

  const mutation = useMutation({
    mutationFn: (usage: SimulatedUsageData) =>
      fetchMutation({
        method: 'POST',
        url: getApiUrl('/_admin/customers/$organizationIdOrSlug/simulated-llm-usage/', {
          path: {organizationIdOrSlug: orgId},
        }),
        data: usage,
      }),
    onSuccess: () => {
      toast.success('Simulated LLM usage recorded');
      onSuccess();
      closeModal();
    },
    onError: error => {
      if (
        error instanceof RequestError &&
        setFieldErrors(form, requestErrorToFieldErrors(error, form.state.values))
      ) {
        return;
      }
      toast.error(
        error instanceof RequestError && typeof error.responseJSON?.detail === 'string'
          ? error.responseJSON.detail
          : 'Unable to record simulated LLM usage.'
      );
    },
  });

  const defaultValues: z.input<typeof schema> = {
    feature: 'test_paid',
    projectId: '',
    costUsd: null,
    timestamp: '',
    ticketUrl: '',
    notes: '',
  };
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      const parsed = schema.parse(value);
      return mutation
        .mutateAsync({
          feature: parsed.feature,
          projectId: Number(parsed.projectId),
          costUsd: parsed.costUsd,
          // datetime-local values carry no offset, so they are read as local time.
          ...(parsed.timestamp
            ? {timestamp: new Date(parsed.timestamp).toISOString()}
            : {}),
          ticketUrl: parsed.ticketUrl,
          notes: parsed.notes,
        })
        .catch(() => {});
    },
  });

  if (isPending || isError) {
    return (
      <Fragment>
        <Header closeButton>
          <Heading as="h2">Simulate LLM Usage</Heading>
        </Header>
        <Body>
          {isPending ? <LoadingIndicator /> : <LoadingError onRetry={refetch} />}
        </Body>
      </Fragment>
    );
  }

  const projectOptions = projects.map(project => ({
    value: project.id,
    label: project.slug,
  }));

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h2">Simulate LLM Usage</Heading>
      </Header>
      <Body>
        <Stack gap="lg">
          <Text>
            Record LLM usage for this organization without calling an LLM. Billing counts
            it like real usage, so the customer is invoiced for test_paid usage. Refund it
            afterwards with Change Balance or Grant Ledger Credit.
          </Text>
          <form.AppField name="feature">
            {field => (
              <field.Layout.Stack label="Feature" required>
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={FEATURE_OPTIONS}
                  disabled={mutation.isPending}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="projectId">
            {field => (
              <field.Layout.Stack label="Project" required>
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={projectOptions}
                  disabled={mutation.isPending}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="costUsd">
            {field => (
              <field.Layout.Stack label="Cost" hintText="In dollars" required>
                <field.Number
                  value={field.state.value}
                  onChange={field.handleChange}
                  disabled={mutation.isPending}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="timestamp">
            {field => (
              <field.Layout.Stack
                label="Timestamp"
                hintText="In your local time, at most 31 days ago. Leave empty to use now."
              >
                <field.Input
                  type="datetime-local"
                  value={field.state.value}
                  onChange={field.handleChange}
                  disabled={mutation.isPending}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="ticketUrl">
            {field => (
              <field.Layout.Stack label="Ticket URL">
                <field.Input
                  type="url"
                  value={field.state.value}
                  onChange={field.handleChange}
                  disabled={mutation.isPending}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="notes">
            {field => (
              <field.Layout.Stack label="Notes" required>
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  maxLength={500}
                  disabled={mutation.isPending}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>Cancel</Button>
          <form.SubmitButton>Record Usage</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}

export const triggerSimulateLlmUsageModal = (
  opts: Omit<SimulateLlmUsageModalProps, keyof ModalRenderProps>
) => openModal(deps => <SimulateLlmUsageModal {...deps} {...opts} />);
