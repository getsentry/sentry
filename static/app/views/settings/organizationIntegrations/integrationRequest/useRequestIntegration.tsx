import {useState} from 'react';

import {useModal} from '@sentry/scraps/modal';

import type {IntegrationType} from 'sentry/types/integrations';

import {RequestIntegrationModal} from './RequestIntegrationModal';

type IntegrationRequest = {
  name: string;
  slug: string;
  type: IntegrationType;
};

export function useRequestIntegration() {
  const {openModal} = useModal();
  const [isOpen, setIsOpen] = useState(false);
  const [sentRequests, setSentRequests] = useState<string[]>([]);

  const isSent = ({type, slug}: IntegrationRequest) =>
    sentRequests.includes(`${type}:${slug}`);

  const openRequestModal = (integration: IntegrationRequest) => {
    if (isOpen || isSent(integration)) {
      return;
    }
    setIsOpen(true);
    openModal(
      renderProps => (
        <RequestIntegrationModal
          {...integration}
          {...renderProps}
          onSuccess={() =>
            setSentRequests(sent => [...sent, `${integration.type}:${integration.slug}`])
          }
        />
      ),
      {onClose: () => setIsOpen(false)}
    );
  };

  return {isOpen, isSent, openRequestModal};
}
