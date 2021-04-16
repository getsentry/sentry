import React from 'react';
import styled from '@emotion/styled';

import {openModal} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {IntegrationType, Organization} from 'app/types';

import RequestIntegrationModal from './RequestIntegrationModal';

type Props = {
  organization: Organization;
  name: string;
  slug: string;
  type: IntegrationType;
};
type State = {
  isOpen: boolean;
  isSent: boolean;
};

export default class RequestIntegrationButton extends React.Component<Props, State> {
  state = {
    isOpen: false,
    isSent: false,
  };

  openRequestModal() {
    this.setState({isOpen: true});
    openModal(
      renderProps => (
        <RequestIntegrationModal
          {...this.props}
          {...renderProps}
          onSuccess={() => this.setState({isSent: true})}
        />
      ),
      {
        onClose: () => this.setState({isOpen: false}),
      }
    );
  }

  render() {
    const {isOpen, isSent} = this.state;

    let buttonText;
    if (isOpen) {
      buttonText = t('Requesting Installation');
    } else if (isSent) {
      buttonText = t('Installation Requested');
    } else {
      buttonText = t('Request Installation');
    }

    return (
      <StyledRequestIntegrationButton
        data-test-id="request-integration-button"
        disabled={isOpen || isSent}
        onClick={() => this.openRequestModal()}
        priority="primary"
        size="small"
      >
        {buttonText}
      </StyledRequestIntegrationButton>
    );
  }
}

const StyledRequestIntegrationButton = styled(Button)`
  margin-left: ${space(1)};
`;
