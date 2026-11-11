import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import type {IntegrationType} from 'sentry/types/integrations';

import {useRequestIntegration} from './useRequestIntegration';

type Props = {
  name: string;
  slug: string;
  type: IntegrationType;
};

export function RequestIntegrationButton(props: Props) {
  const {isOpen, isSent, openRequestModal} = useRequestIntegration();
  const requestSent = isSent(props);

  let buttonText: string;
  if (isOpen) {
    buttonText = t('Requesting Installation');
  } else if (requestSent) {
    buttonText = t('Installation Requested');
  } else {
    buttonText = t('Request Installation');
  }

  return (
    <StyledRequestIntegrationButton
      data-test-id="request-integration-button"
      disabled={isOpen || requestSent}
      onClick={() => openRequestModal(props)}
      variant="primary"
      size="sm"
    >
      {buttonText}
    </StyledRequestIntegrationButton>
  );
}

const StyledRequestIntegrationButton = styled(Button)`
  margin-left: ${p => p.theme.space.md};
`;
