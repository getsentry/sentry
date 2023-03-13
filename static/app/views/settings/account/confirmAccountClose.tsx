import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import {t} from 'sentry/locale';

export function ConfirmAccountClose({
  handleRemoveAccount,
}: {
  handleRemoveAccount: () => void;
}) {
  return (
    <Confirm
      priority="danger"
      message={t(
        'This is permanent and cannot be undone, are you really sure you want to do this?'
      )}
      onConfirm={handleRemoveAccount}
    >
      <Button priority="danger">{t('Close Account')}</Button>
    </Confirm>
  );
}
