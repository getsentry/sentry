import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';

export type StaffErrorDetail =
  | string
  | {code?: string; message?: string}
  | null
  | undefined;

export function handleStaffPermissionError(responseDetail: StaffErrorDetail) {
  if (typeof responseDetail !== 'string' && responseDetail?.code === 'staff-required') {
    addErrorMessage(
      t(
        'Re-authenticate as staff first and then return to this page and try again. Redirecting...'
      )
    );
    setTimeout(() => {
      window.location.href = '/_admin/';
    }, 2000);
    return;
  }

  addErrorMessage(t('Access denied. You may need to re-authenticate as staff.'));
}
