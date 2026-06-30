import {useEffect} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {showIntercom} from 'sentry/utils/intercom';
import {useOrganization} from 'sentry/utils/useOrganization';

import {trackGetsentryAnalytics} from 'getsentry/utils/trackGetsentryAnalytics';

type Props = {
  closeModal: () => void;
};

export function HelpSearchFooter({closeModal}: Props) {
  const organization = useOrganization();

  useEffect(() => {
    trackGetsentryAnalytics('intercom_link.viewed', {
      organization,
      source: 'help_modal',
    });
  }, [organization]);

  async function handleIntercomClick() {
    trackGetsentryAnalytics('intercom_link.clicked', {
      organization,
      source: 'help_modal',
    });
    try {
      await showIntercom(organization.slug);
    } catch {
      const supportEmail = ConfigStore.get('supportEmail');
      if (supportEmail) {
        window.location.href = `mailto:${supportEmail}`;
      }
    }
    closeModal();
  }

  return (
    <Container>
      {t('Need personalized help? Contact our support team!')}
      <Button size="sm" onClick={handleIntercomClick}>
        {t('Contact Us')}
      </Button>
    </Container>
  );
}

const Container = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${p => p.theme.space.xl};
  background: ${p => p.theme.tokens.background.primary};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  font-size: ${p => p.theme.font.size.md};
`;
