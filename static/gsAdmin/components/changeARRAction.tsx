import {Fragment} from 'react';
import {z} from 'zod';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {useModal} from '@sentry/scraps/modal';
import type {ModalRenderProps} from '@sentry/scraps/modal';

type Props = {
  // TODO(ts): Type customer when available
  customer: any;
  onAction: (data: any) => void;
};

const schema = z.object({
  acv: z
    .number()
    .int('Enter a whole number')
    .min(0, 'ARR cannot be negative')
    .nullable()
    .refine(value => value !== null, 'Enter the new ARR'),
});

export function ChangeARRAction(props: Props) {
  const {openModal} = useModal();

  return (
    <Button
      variant="link"
      size="zero"
      onClick={() =>
        openModal(renderProps => <ChangeARRModal {...props} {...renderProps} />)
      }
    >
      Change
    </Button>
  );
}

type ModalProps = ModalRenderProps & Props;

function ChangeARRModal({
  customer,
  onAction,
  closeModal,
  Header,
  Body,
  Footer,
}: ModalProps) {
  const defaultValues: z.input<typeof schema> = {
    acv: typeof customer.acv === 'number' ? customer.acv / 100 : null,
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      closeModal();
      onAction({customPrice: (value.acv ?? 0) * 100});
    },
  });

  return (
    <form.AppForm form={form}>
      <Header>Update Annual Recurring Revenue</Header>
      <Body>
        <form.AppField name="acv">
          {field => (
            <field.Layout.Stack
              label="ARR"
              hintText={
                <Fragment>
                  Their new annual contract value will be{' '}
                  <strong>${(field.state.value ?? 0).toLocaleString()}</strong>
                </Fragment>
              }
            >
              <field.Number value={field.state.value} onChange={field.handleChange} />
            </field.Layout.Stack>
          )}
        </form.AppField>
      </Body>
      <Footer>
        <ButtonBar>
          <Button onClick={closeModal}>Cancel</Button>
          <form.Subscribe selector={state => schema.safeParse(state.values).success}>
            {isValid => <form.SubmitButton disabled={!isValid}>Submit</form.SubmitButton>}
          </form.Subscribe>
        </ButtonBar>
      </Footer>
    </form.AppForm>
  );
}
