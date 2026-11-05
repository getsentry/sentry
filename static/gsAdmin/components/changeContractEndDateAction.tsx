import moment from 'moment-timezone';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormValidators, ScrapsForm, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {openModal, type ModalRenderProps} from 'sentry/actionCreators/modal';

interface ChangeContractEndDateModalProps extends ModalRenderProps {
  contractPeriodEnd: string;
  onAction: (data: Record<string, unknown>) => Promise<unknown>;
}

const schema = z.object({
  contractPeriodEnd: z.iso.date('Enter a valid end date'),
});

function ChangeContractEndDateModal({
  contractPeriodEnd,
  onAction,
  Header,
  Body,
  Footer,
  closeModal,
}: ChangeContractEndDateModalProps) {
  const form = useScrapsForm({
    defaultValues: {contractPeriodEnd},
    validators: defaultFormValidators(schema),
    onSubmit: ({value}) =>
      onAction(value)
        .then(() => closeModal())
        .catch(() => {}),
  });

  return (
    <ScrapsForm form={form}>
      <Header closeButton>
        <Heading as="h3">Update Contract End Date</Heading>
      </Header>
      <Body>
        <form.Field name="contractPeriodEnd">
          {field => (
            <field.Layout.Stack
              label="End Date"
              hintText="The date at which this contract should end."
              required
            >
              <field.Input
                type="date"
                value={field.value}
                onChange={field.handleChange}
              />
            </field.Layout.Stack>
          )}
        </form.Field>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>Cancel</Button>
          <form.SubmitButton>Submit</form.SubmitButton>
        </Flex>
      </Footer>
    </ScrapsForm>
  );
}

type Options = Omit<ChangeContractEndDateModalProps, keyof ModalRenderProps>;

const openActionModal = (props: Options) =>
  openModal(deps => <ChangeContractEndDateModal {...deps} {...props} />);

export function ChangeContractEndDateAction(props: Options) {
  return (
    <Button variant="link" size="zero" onClick={() => openActionModal(props)}>
      {moment(props.contractPeriodEnd).format('ll')}
    </Button>
  );
}
