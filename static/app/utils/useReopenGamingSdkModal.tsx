import {useEffect, useRef} from 'react';
import {useQueryState} from 'nuqs';

import {openPrivateGamingSdkAccessModal} from 'sentry/actionCreators/modal';
import type {PrivateGamingSdkAccessModalProps} from 'sentry/components/modals/privateGamingSdkAccessModal';
import {parseAsBooleanLiteral} from 'sentry/utils/url/parseAsBooleanLiteral';

export function useReopenGamingSdkModal(
  modalProps: Omit<PrivateGamingSdkAccessModalProps, 'onSubmit'> & {onSubmit?: () => void}
) {
  const [reopenModal, setReopenModal] = useQueryState(
    'reopenGamingSdkModal',
    parseAsBooleanLiteral.withOptions({history: 'replace'})
  );
  const modalPropsRef = useRef(modalProps);
  modalPropsRef.current = modalProps;

  useEffect(() => {
    if (reopenModal) {
      setReopenModal(null);
      openPrivateGamingSdkAccessModal(modalPropsRef.current);
    }
  }, [reopenModal, setReopenModal]);
}
