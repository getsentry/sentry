import {Fragment} from 'react';

import {t} from 'app/locale';
import ConfirmHeader from 'app/views/settings/account/accountSecurity/components/confirmHeader';
import Confirm from 'app/components/confirm';
import TextBlock from 'app/views/settings/components/text/textBlock';

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

const RemoveConfirm = props => <Confirm {...props} message={message} />;

export default RemoveConfirm;
