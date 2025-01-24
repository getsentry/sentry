import {useState} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {IntegrationType} from 'sentry/types/integrations';

import RequestIntegrationModal from './RequestIntegrationModal';

type Props = {
  name: string;
  slug: string;
  type: IntegrationType;
};

export default function RequestIntegrationButton(props: Props) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isSent, setIsSent] = useState<boolean>(false);

  const openRequestModal = () => {
    setIsOpen(true);
    openModal(
      renderProps => (
        <RequestIntegrationModal
          {...props}
          {...renderProps}
          onSuccess={() => setIsSent(true)}
        />
      ),
      {
        onClose: () => setIsOpen(false),
      }
    );
  };

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
      onClick={openRequestModal}
      priority="primary"
      size="sm"
    >
      {buttonText}
    </StyledRequestIntegrationButton>
  );
}

const StyledRequestIntegrationButton = styled(Button)`
  margin-left: ${space(1)};
`;
