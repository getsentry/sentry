import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';

type Props = {
  onAction: (effectiveAt: string) => void;
};

type ChangeEffectiveAtModalProps = Props & ModalRenderProps;

function ChangeEffectiveAtModal({
  Header,
  Body,
  Footer,
  closeModal,
  onAction,
}: ChangeEffectiveAtModalProps) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {effectiveAt: ''},
    onSubmit: ({value}) => {
      onAction(value.effectiveAt);
      closeModal();
    },
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>Change Effective At Date</Header>
      <Body>
        <form.AppField name="effectiveAt">
          {field => (
            <field.Layout.Stack
              label="Effective At"
              hintText="Invoice date used for ARR calculations"
            >
              <field.Input
                type="date"
                value={field.state.value}
                onChange={field.handleChange}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>Cancel</Button>
          <form.Subscribe selector={state => state.isPristine}>
            {isPristine => (
              <form.SubmitButton disabled={isPristine}>Submit</form.SubmitButton>
            )}
          </form.Subscribe>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}

export const openChangeEffectiveAtModal = ({onAction}: Props) =>
  openModal(modalProps => <ChangeEffectiveAtModal {...modalProps} onAction={onAction} />);
