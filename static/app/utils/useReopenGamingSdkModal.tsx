import {useEffect} from 'react';

import {openPrivateGamingSdkAccessModal} from 'sentry/actionCreators/modal';
import type {PrivateGamingSdkAccessModalProps} from 'sentry/components/modals/privateGamingSdkAccessModal';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

export function useReopenGamingSdkModal(
  modalProps: Omit<PrivateGamingSdkAccessModalProps, 'onSubmit'> & {onSubmit?: () => void}
) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('reopenGamingSdkModal') === 'true') {
      searchParams.delete('reopenGamingSdkModal');
      const newSearch = searchParams.toString();
      const newPath = location.pathname + (newSearch ? `?${newSearch}` : '');
      navigate(newPath, {replace: true});
      openPrivateGamingSdkAccessModal(modalProps);
    }
  }, [location.search, location.pathname, navigate, modalProps]);
}
