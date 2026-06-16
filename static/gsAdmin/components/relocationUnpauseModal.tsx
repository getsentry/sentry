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
  untilStep: z.string(),
});

export function RelocationUnpauseModal({
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
  options.unshift({value: 'NONE', label: 'Completion'});

  const mutation = useMutation({
    mutationFn: (data: {untilStep?: string}) =>
      fetchMutation<Relocation>({
        method: 'PUT',
        url: `/relocations/${relocation.uuid}/unpause/`,
        data,
        options: {host: relocation.region.url},
      }),
    onSuccess: rawRelocation => {
      addSuccessMessage(
        'All current or future pauses for this relocation have been removed.'
      );
      onSuccess?.(rawRelocation);
      closeModal();
    },
    onError: (error: unknown) => {
      const fallback = 'Failed to unpause relocation.';
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
    defaultValues: {untilStep: ''},
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      const payload: {untilStep?: string} = {};
      if (value.untilStep && value.untilStep !== 'NONE') {
        payload.untilStep = value.untilStep;
      }
      return mutation.mutateAsync(payload).catch(() => {});
    },
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>Unpause Relocation</Header>
      <Body>
        <form.AppField name="untilStep">
          {field => (
            <field.Layout.Stack
              label="Until"
              hintText="Optionally select another future step to pause at:"
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
        <form.SubmitButton>Unpause</form.SubmitButton>
      </Footer>
    </form.AppForm>
  );
}
