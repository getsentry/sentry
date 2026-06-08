import {Fragment} from 'react';

import {Button} from '@sentry/scraps/button';

import {Confirm} from 'sentry/components/confirm';
import {t} from 'sentry/locale';

export function ConfirmAccountClose({
  handleRemoveAccount,
  organizationSlugs,
  userEmail,
}: {
  handleRemoveAccount: () => void;
  organizationSlugs: string[];
  userEmail: string;
}) {
  const message = (
    <Fragment>
      <p>
        <strong>{t('Close Account:')}</strong> {userEmail}
      </p>
      {organizationSlugs.length > 0 && (
        <p>
          <strong>{t('Delete Organization(s):')}</strong> {organizationSlugs.join(', ')}
        </p>
      )}
      <p>
        {t(
          'WARNING! This is permanent and cannot be undone, are you really sure you want to do this?'
        )}
      </p>
    </Fragment>
  );

  return (
    <Confirm
      priority="danger"
      message={message}
      onConfirm={() => {
        handleRemoveAccount();
      }}
    >
      <Button variant="danger">{t('Close Account and Delete Organizations')}</Button>
    </Confirm>
  );
}
