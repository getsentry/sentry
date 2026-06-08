import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

import type {Relocation} from 'admin/types';
import {RelocationSteps} from 'admin/types';
import {titleCase} from 'getsentry/utils/titleCase';

type Props = ModalRenderProps & {
  relocation: Relocation;
  onSuccess?: (relocation: Relocation) => void;
};

const schema = z.object({
  atStep: z.string().min(1, 'Please select a step'),
});

export function RelocationCancelModal({
  Body,
  Header,
  Footer,
  relocation,
  onSuccess,
  closeModal,
}: Props) {
  const currentStep = RelocationSteps[relocation.step];
  const options = Object.keys(RelocationSteps)
    .filter(
      step =>
        RelocationSteps[step as keyof typeof RelocationSteps] > currentStep &&
        step !== 'COMPLETED'
    )
    .map(step => ({value: step, label: titleCase(step)}));
  options.unshift({value: 'ASAP', label: 'As soon as possible'});

  const mutation = useMutation({
    mutationFn: (data: {atStep?: string}) =>
      fetchMutation<Relocation>({
        method: 'PUT',
        url: `/relocations/${relocation.uuid}/cancel/`,
        data,
        options: {host: relocation.region.url},
      }),
    onSuccess: rawRelocation => {
      addSuccessMessage('This relocation has been scheduled for cancellation.');
      onSuccess?.(rawRelocation);
      closeModal();
    },
    onError: (error: unknown) => {
      const fallback = 'Failed to schedule cancellation.';
      if (!(error instanceof RequestError)) {
        addErrorMessage(fallback);
        return;
      }
      const detail = error.responseJSON?.detail;
      const message = typeof detail === 'string' ? detail : detail?.message;
      addErrorMessage(message ?? fallback);
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {atStep: ''},
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      const payload: {atStep?: string} = {};
      if (value.atStep !== 'ASAP') {
        payload.atStep = value.atStep;
      }
      return mutation.mutateAsync(payload).catch(() => {});
    },
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>Cancel Relocation</Header>
      <Body>
        <form.AppField name="atStep">
          {field => (
            <field.Layout.Stack
              label="Scheduled At"
              hintText="Select a step to cancel PRIOR to:"
              required
            >
              <field.Select
                value={field.state.value}
                onChange={field.handleChange}
                options={options}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
      </Body>
      <Footer>
        <form.SubmitButton>Schedule</form.SubmitButton>
      </Footer>
    </form.AppForm>
  );
}
