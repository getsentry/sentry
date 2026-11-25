import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import type {ModalRenderProps} from '@sentry/scraps/modal';
import {openModal} from '@sentry/scraps/modal';
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

const NO_COHORT = 'none';

const COHORT_OPTIONS = [
  {value: NO_COHORT, label: 'None'},
  {value: 'legacy', label: 'Legacy'},
  {value: 'seat', label: 'Seat'},
  {value: 'free', label: 'Free'},
] as const;

const schema = z.object({cohort: z.enum([NO_COHORT, 'legacy', 'seat', 'free'])});

interface ChangeAgenticTriageCohortModalProps extends ModalRenderProps {
  onSuccess: () => void;
  organization: Organization;
}

function ChangeAgenticTriageCohortModal({
  Header,
  Body,
  Footer,
  closeModal,
  organization,
  onSuccess,
}: ChangeAgenticTriageCohortModalProps) {
  const currentCohort = organization.agenticTriageCohort ?? null;

  const mutation = useMutation({
    mutationFn: (data: {agenticTriageCohort: Organization['agenticTriageCohort']}) =>
      fetchMutation<Organization>({
        method: 'PUT',
        url: getApiUrl('/organizations/$organizationIdOrSlug/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        data,
      }),
    onSuccess: () => {
      toast.success('Agentic triage cohort updated.');
      onSuccess();
      closeModal();
    },
    onError: () => {
      toast.error('Failed to update agentic triage cohort.');
    },
  });

  const defaultValues: z.input<typeof schema> = {cohort: currentCohort ?? NO_COHORT};
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      const {cohort} = schema.parse(value);
      return mutation
        .mutateAsync({agenticTriageCohort: cohort === NO_COHORT ? null : cohort})
        .catch(() => {});
    },
  });

  return (
    <form.AppForm form={form}>
      <Header>
        <Heading as="h2">Change Agentic Triage Cohort</Heading>
      </Header>
      <Body>
        <Stack gap="xl">
          <Text>
            <Text bold>Current value: </Text>
            {currentCohort ?? 'None'}
          </Text>
          <Text variant="muted">
            Legacy and Seat only take effect once the organization is token-billed. Free
            applies regardless of billing.
          </Text>
          <form.AppField name="cohort">
            {field => (
              <field.Layout.Stack
                label="Cohort"
                hintText="Which agentic triage cohort this organization belongs to."
                required
              >
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={COHORT_OPTIONS}
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
          <form.SubmitButton>Save</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}

export function openChangeAgenticTriageCohortModal({
  organization,
  onSuccess,
}: {
  onSuccess: () => void;
  organization: Organization;
}) {
  openModal(modalProps => (
    <ChangeAgenticTriageCohortModal
      {...modalProps}
      organization={organization}
      onSuccess={onSuccess}
    />
  ));
}
