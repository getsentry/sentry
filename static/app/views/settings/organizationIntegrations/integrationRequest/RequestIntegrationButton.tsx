import {Component} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {IntegrationType} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';

import RequestIntegrationModal from './RequestIntegrationModal';

type Props = {
  name: string;
  organization: Organization;
  slug: string;
  type: IntegrationType;
};
type State = {
  isOpen: boolean;
  isSent: boolean;
};

export default class RequestIntegrationButton extends Component<Props, State> {
  state: State = {
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

    let buttonText: any;
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
        size="sm"
      >
        {buttonText}
      </StyledRequestIntegrationButton>
    );
  }
}

const StyledRequestIntegrationButton = styled(Button)`
  margin-left: ${space(1)};
`;
