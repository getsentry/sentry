import {Fragment} from 'react';

import Confirm from 'sentry/components/confirm';
import {t} from 'sentry/locale';
import ConfirmHeader from 'sentry/views/settings/account/accountSecurity/components/confirmHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = React.ComponentProps<typeof Confirm>;

const message = (
  <Fragment>
    <ConfirmHeader>{t('Do you want to remove this method?')}</ConfirmHeader>
    <TextBlock>
      {t(
        'Removing the last authentication method will disable two-factor authentication completely.'
      )}
    </TextBlock>
  </Fragment>
);

function RemoveConfirm(props: Props) {
  return <Confirm {...props} message={message} />;
}

export default RemoveConfirm;
