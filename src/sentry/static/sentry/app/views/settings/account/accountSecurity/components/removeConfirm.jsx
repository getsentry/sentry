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
            <ConfirmHeader>{t('Do you want to remove this method?')}</ConfirmHeader>
            <TextBlock>
              {t(
                'Removing the last authentication method will disable two-factor authentication completely.'
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
