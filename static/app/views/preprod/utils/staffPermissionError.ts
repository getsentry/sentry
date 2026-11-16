import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';

type StaffErrorDetail = string | {code?: string; message?: string} | null | undefined;

export function handleStaffPermissionError(responseDetail: StaffErrorDetail) {
  if (typeof responseDetail !== 'string' && responseDetail?.code === 'staff-required') {
    toast.error(
      t(
        'Re-authenticate as staff first and then return to this page and try again. Redirecting...'
      )
    );
    setTimeout(() => {
      window.location.href = '/_admin/';
    }, 2000);
    return;
  }

  toast.error(t('Access denied. You may need to re-authenticate as staff.'));
}
