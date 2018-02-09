import React from 'react';

import {t} from '../../../../../locale';
import ConfirmHeader from './confirmHeader';
import Confirm from '../../../../../components/confirm';
import TextBlock from '../../../components/text/textBlock';

class RemoveConfirm extends React.Component {
  render() {
    return (
      <Confirm
        message={
          <React.Fragment>
            <ConfirmHeader>{t('Do you want to remove the method?')}</ConfirmHeader>
            <TextBlock>
              {t(
                'You will no longer be able to use it for two-factor authentication afterwards. Removing the last authenticator removes two-factor authentication completely.'
              )}
            </TextBlock>
          </React.Fragment>
        }
        {...this.props}
      />
    );
  }
}

export default RemoveConfirm;
