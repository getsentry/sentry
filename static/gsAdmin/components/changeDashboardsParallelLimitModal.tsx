import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

const DEFAULT_PARALLEL_LIMIT = 20;

const schema = z.object({
  dashboardsAsyncQueueParallelLimit: z
    .number({message: 'Parallel limit is required'})
    .min(1, 'Parallel limit must be at least 1'),
});

interface ChangeDashboardsParallelLimitModalProps extends ModalRenderProps {
  onSuccess: () => void;
  organization: Organization;
}

function ChangeDashboardsParallelLimitModal({
  Header,
  Body,
  Footer,
  closeModal,
  organization,
  onSuccess,
}: ChangeDashboardsParallelLimitModalProps) {
  const currentLimit =
    organization.dashboardsAsyncQueueParallelLimit ?? DEFAULT_PARALLEL_LIMIT;

  const mutation = useMutation({
    mutationFn: (data: {dashboardsAsyncQueueParallelLimit: number}) =>
      fetchMutation<Organization>({
        method: 'PUT',
        url: getApiUrl('/organizations/$organizationIdOrSlug/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        data,
      }),
    onSuccess: () => {
      addSuccessMessage('Dashboard parallel query limit updated.');
      onSuccess();
      closeModal();
    },
    onError: () => {
      addErrorMessage('Failed to update dashboard parallel query limit.');
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {dashboardsAsyncQueueParallelLimit: currentLimit},
    validators: {onDynamic: schema},
    onSubmit: ({value, formApi}) =>
      mutation.mutateAsync(value).catch(error => {
        if (error instanceof RequestError) {
          setFieldErrors(formApi, error);
        }
      }),
  });

  return (
    <form.AppForm form={form}>
      <Header>
        <Heading as="h2">Change Dashboard Parallel Query Limit</Heading>
      </Header>
      <Body>
        <Stack gap="xl">
          <Text>
            <Text bold>Current value: </Text>
            {currentLimit}
          </Text>
          <form.AppField name="dashboardsAsyncQueueParallelLimit">
            {field => (
              <field.Layout.Stack
                label="Parallel Limit"
                hintText="Controls how many dashboard widget queries can run in parallel."
                required
              >
                <field.Number
                  value={field.state.value}
                  onChange={field.handleChange}
                  min={1}
                  disabled={mutation.isPending}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal} disabled={mutation.isPending}>
            Cancel
          </Button>
          <form.SubmitButton>Save</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}

export function openChangeDashboardsParallelLimitModal({
  organization,
  onSuccess,
}: {
  onSuccess: () => void;
  organization: Organization;
}) {
  openModal(modalProps => (
    <ChangeDashboardsParallelLimitModal
      {...modalProps}
      organization={organization}
      onSuccess={onSuccess}
    />
  ));
}
