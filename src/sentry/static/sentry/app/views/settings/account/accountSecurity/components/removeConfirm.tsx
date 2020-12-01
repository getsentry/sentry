import React from 'react';

import Confirm from 'app/components/confirm';
import {t} from 'app/locale';
import ConfirmHeader from 'app/views/settings/account/accountSecurity/components/confirmHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

type Props = React.ComponentProps<typeof Confirm>;

const message = (
  <React.Fragment>
    <ConfirmHeader>{t('Do you want to remove this method?')}</ConfirmHeader>
    <TextBlock>
      {t(
        'Removing the last authentication method will disable two-factor authentication completely.'
      )}
    </TextBlock>
  </React.Fragment>
);

class RemoveConfirm extends React.Component<Props> {
  static defaultProps = Confirm.defaultProps;

  render() {
    return <Confirm {...this.props} message={message} />;
  }
}

export default RemoveConfirm;
