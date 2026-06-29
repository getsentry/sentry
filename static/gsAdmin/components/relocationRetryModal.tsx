import {Fragment} from 'react';
import {useMutation} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

import type {Relocation} from 'admin/types';

type Props = ModalRenderProps & {
  relocation: Relocation;
  onSuccess?: (relocation: Relocation) => void;
};

export function RelocationRetryModal({
  Body,
  Header,
  Footer,
  relocation,
  onSuccess,
  closeModal,
}: Props) {
  const mutation = useMutation({
    mutationFn: () =>
      fetchMutation<Relocation>({
        method: 'POST',
        url: `/relocations/${relocation.uuid}/retry/`,
        options: {host: relocation.region.url},
      }),
    onSuccess: rawRelocation => {
      addSuccessMessage('This relocation is being retried.');
      onSuccess?.(rawRelocation);
      closeModal();
    },
    onError: (error: unknown) => {
      const fallback = 'Failed to retry relocation.';
      if (!(error instanceof RequestError)) {
        addErrorMessage(fallback);
        return;
      }
      const detail = error.responseJSON?.detail;
      const message = typeof detail === 'string' ? detail : detail?.message;
      addErrorMessage(message ?? fallback);
    },
  });

  return (
    <Fragment>
      <Header closeButton>Retry Relocation</Header>
      <Body>
        <Text as="p">
          Trigger a new relocation with all of the same user submitted data as its
          predecessor. This is useful when transient errors or since-fixed bugs cause a
          relocation attempt to fail.
        </Text>
      </Body>
      <Footer>
        <Button
          variant="primary"
          busy={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Retry
        </Button>
      </Footer>
    </Fragment>
  );
}
