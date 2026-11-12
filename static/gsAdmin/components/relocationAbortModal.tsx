import {Fragment} from 'react';
import {useMutation} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import type {ModalRenderProps} from '@sentry/scraps/modal';
import {Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
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
        url: getApiUrl('/relocations/$relocationUuid/abort/', {
          path: {relocationUuid: relocation.uuid},
        }),
        options: {host: relocation.region.url},
      }),
    onSuccess: rawRelocation => {
      toast.success(
        'This relocation will be immediately halted at the next opportunity.'
      );
      onSuccess?.(rawRelocation);
      closeModal();
    },
    onError: (error: unknown) => {
      const fallback = 'Failed to abort relocation.';
      if (!(error instanceof RequestError)) {
        toast.error(fallback);
        return;
      }
      const detail = error.responseJSON?.detail;
      const message = typeof detail === 'string' ? detail : detail?.message;
      toast.error(message ?? fallback);
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
