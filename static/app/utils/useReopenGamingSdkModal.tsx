import {useEffect, useRef} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useQueryState} from 'nuqs';

import {openPrivateGamingSdkAccessModal} from 'sentry/actionCreators/modal';
import type {PrivateGamingSdkAccessModalProps} from 'sentry/components/modals/privateGamingSdkAccessModal';

import {apiOptions} from './api/apiOptions';
import {parseAsBooleanLiteral} from './url/parseAsBooleanLiteral';

export function useReopenGamingSdkModal(
  modalProps: Omit<PrivateGamingSdkAccessModalProps, 'onSubmit'> & {onSubmit?: () => void}
) {
  const [reopenModal, setReopenModal] = useQueryState(
    'reopenGamingSdkModal',
    parseAsBooleanLiteral.withOptions({history: 'replace'})
  );
  const modalPropsRef = useRef(modalProps);
  const queryClient = useQueryClient();
  // oxlint-disable-next-line react/refs
  modalPropsRef.current = modalProps;

  useEffect(() => {
    if (reopenModal) {
      queryClient.invalidateQueries({
        queryKey: apiOptions.queryKey('/users/$userId/user-identities/', {
          path: {userId: 'me'},
        }),
      });
      setReopenModal(null);
      openPrivateGamingSdkAccessModal(modalPropsRef.current);
    }
  }, [reopenModal, setReopenModal, queryClient]);
}
