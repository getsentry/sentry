import React from 'react';

import {ModalRenderProps} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import {DynamicSamplingRule} from 'app/types/dynamicSampling';

type Props = ModalRenderProps & {
  organization: Organization;
  onSubmit: (rule: DynamicSamplingRule) => void;
  platformDocLink?: string;
};

type State = {};

class ErrorRuleModal extends React.Component<Props, State> {
  render() {
    const {Header, Body, closeModal} = this.props;

    return (
      <React.Fragment>
        <Header closeButton onHide={closeModal}>
          {t('Add a custom rule for errors')}
        </Header>
        <Body>{null}</Body>
      </React.Fragment>
    );
  }
}

export default ErrorRuleModal;
