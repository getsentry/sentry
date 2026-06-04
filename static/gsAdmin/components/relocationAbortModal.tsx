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

export function RelocationAbortModal({
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
        method: 'PUT',
        url: `/relocations/${relocation.uuid}/abort/`,
        options: {host: relocation.region.url},
      }),
    onSuccess: rawRelocation => {
      addSuccessMessage(
        'This relocation will be immediately halted at the next opportunity.'
      );
      onSuccess?.(rawRelocation);
      closeModal();
    },
    onError: (error: unknown) => {
      const fallback = 'Failed to abort relocation.';
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
      <Header closeButton>Abort Relocation</Header>
      <Body>
        <Text as="p">
          This is a potentially dangerous, irreversible operation! Please be sure that you
          know what you're doing before aborting this relocation!
        </Text>
      </Body>
      <Footer>
        <Button
          variant="danger"
          busy={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Abort
        </Button>
      </Footer>
    </Fragment>
  );
}
