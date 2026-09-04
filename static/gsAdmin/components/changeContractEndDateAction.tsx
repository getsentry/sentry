import {useMutation} from '@tanstack/react-query';
import moment from 'moment-timezone';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {openModal, type ModalRenderProps} from 'sentry/actionCreators/modal';
import {RequestError} from 'sentry/utils/requestError/requestError';

interface ChangeContractEndDateModalProps extends ModalRenderProps {
  contractPeriodEnd: string;
  onAction: (data: Record<string, any>) => Promise<unknown>;
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
  const mutation = useMutation({
    mutationFn: (data: {contractPeriodEnd: string}) => onAction(data),
    onSuccess: () => {
      closeModal();
    },
    onError: error => {
      if (error instanceof RequestError) {
        setFieldErrors(form, error);
      }
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {contractPeriodEnd},
    validators: {onDynamic: schema},
    onSubmit: ({value}) => mutation.mutateAsync(value).catch(() => {}),
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h3">Update Contract End Date</Heading>
      </Header>
      <Body>
        <form.AppField name="contractPeriodEnd">
          {field => (
            <field.Layout.Stack
              label="End Date"
              hintText="The date at which this contract should end."
              required
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
          <form.SubmitButton>Submit</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
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
