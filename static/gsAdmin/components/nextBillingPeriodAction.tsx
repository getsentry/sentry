import {useMutation} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal, type ModalRenderProps} from 'sentry/actionCreators/modal';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

import type {Subscription} from 'getsentry/types';

interface EndPeriodEarlyModalProps extends ModalRenderProps {
  onSuccess: () => void;
  orgId: string;
  subscription: Subscription;
}

function EndPeriodEarlyModal({
  orgId,
  onSuccess,
  closeModal,
  Header,
  Body,
  Footer,
}: EndPeriodEarlyModalProps) {
  const mutation = useMutation({
    mutationFn: () =>
      fetchMutation({
        url: getApiUrl('/customers/$organizationIdOrSlug/', {
          path: {organizationIdOrSlug: orgId},
        }),
        method: 'PUT',
        data: {endPeriodEarly: true},
      }),
    onSuccess: () => {
      addSuccessMessage('Current period ended successfully');
      onSuccess();
      closeModal();
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {},
    onSubmit: () => mutation.mutateAsync().catch(() => {}),
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h3">End Current Period Immediately</Heading>
      </Header>
      <Body>
        <Stack gap="lg">
          <Alert.Container>
            <Alert variant="warning" showIcon={false}>
              Ending the current billing period will immediately start the next billing
              cycle and may impact invoicing and usage proration.
            </Alert>
          </Alert.Container>
          <Text as="p">
            End the current billing period immediately and start a new one.
          </Text>
        </Stack>
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

type Options = Omit<EndPeriodEarlyModalProps, keyof ModalRenderProps>;

export const triggerEndPeriodEarlyModal = (opts: Options) =>
  openModal(deps => <EndPeriodEarlyModal {...deps} {...opts} />);
