import React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {fetchGuides} from 'sentry/actionCreators/guides';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {navigateTo} from 'sentry/actionCreators/navigation';
import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import ModalTask from 'sentry/components/onboardingWizard/modalTask';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {IconClose} from 'sentry/icons/iconClose';
import {t, tct} from 'sentry/locale';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {useRouteContext} from 'sentry/utils/useRouteContext';

type Props = ModalRenderProps & {orgSlug: string | null; tour: string};

function DemoEndingModal({tour, closeModal, orgSlug}: Props) {
  const api = new Client();

  const routeContext = useRouteContext();
  const {router} = routeContext;

  function togglePanel(panel: SidebarPanelKey) {
    SidebarPanelStore.togglePanel(panel);
  }

  let cardTitle, body, guides, location;
  switch (tour) {
    case 'issues':
      cardTitle = 'Issues Tour';
      body = 'completing the Issues tour';
      guides = ['issues_v3', 'issue_stream_v3'];
      location = `/organizations/${orgSlug}/issues/`;
      break;
    case 'performance':
      cardTitle = 'Performance Tour';
      body = 'completing the Performance tour';
      guides = ['performance', 'transaction_summary', 'transaction_details_v2'];
      location = `/organizations/${orgSlug}/performance/`;
      break;
    case 'releases':
      cardTitle = 'Releases Tour';
      body = 'completing the Releases tour';
      guides = ['releases_v2', 'react-native-release', 'release-details_v2'];
      location = `/organizations/${orgSlug}/releases/`;
      break;
    case 'tabs':
      cardTitle = 'Check out the different tabs';
      body = 'checking out the different tabs';
      guides = ['sidebar_v2'];
      location = `/organizations/${orgSlug}/projects/`;
      break;
    default:
  }

  const sandboxData = window.SandboxData;
  const url = sandboxData?.cta?.url || 'https://sentry.io/signup/';

  async function handleRestart() {
    await Promise.all(
      guides.map(guide =>
        api.requestPromise('/assistant/', {
          method: 'PUT',
          data: {guide, status: 'restart'},
        })
      )
    ).then(() => {
      if (tour === 'issues') {
        localStorage.setItem('issueGuide', '1');
      }
      if (tour === 'tabs') {
        localStorage.setItem('sidebarGuide', '1');
      }

      if (closeModal) {
        closeModal();
      }

      fetchGuides();

      const redirectUrl = new URL(location, window.location.origin);
      redirectUrl.searchParams.append('referrer', 'demo_task');
      navigateTo(redirectUrl.toString(), router);
    });
  }

  const handleMoreTours = () => {
    if (closeModal) {
      closeModal();
    }
    togglePanel(SidebarPanelKey.OnboardingWizard);
  };

  return (
    <EndModal>
      <CloseButton
        size="zero"
        onClick={() => {
          if (closeModal) {
            closeModal();
          }
        }}
        aria-label={t('Close')}
        icon={<IconClose size="xs" />}
      />
      <Body>
        <h2> {t('Tour Complete')} </h2>
      </Body>
      <ModalTask title={tct('[title]', {title: cardTitle})} />
      <Body>
        {tct(
          'Thank you for [body]. Learn about other Sentry features by starting another tour.',
          {body}
        )}
      </Body>
      <ButtonContainer>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <SignUpButton>
            {tct('[prompt]', {prompt: sandboxData?.cta?.title || 'Sign up for Sentry'})}
          </SignUpButton>
        </a>
        <ButtonBar>
          <ModalButton onClick={handleMoreTours}> {t('More Tours')} </ModalButton>
          <ModalButton onClick={handleRestart}>{t('Restart Tour')}</ModalButton>
        </ButtonBar>
      </ButtonContainer>
    </EndModal>
  );
}

export const modalCss = css`
  width: 100%;
  max-width: 500px;
  [role='document'] {
    position: relative;
    padding: 50px 60px;
  }
`;

const EndModal = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
`;

const Body = styled('div')`
  p {
    font-size: 16px;
    text-align: center;
    margin: 0;
  }
  h2 {
    font-size: 2em;
    margin: 0;
  }
`;

const CloseButton = styled(Button)`
  position: absolute;
  right: -15px;
  top: -15px;
  height: 30px;
  width: 30px;
  border-radius: 50%;
  background-color: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
`;

const ModalButton = styled(Button)`
  background-color: ${p => p.theme.white};
`;

const SignUpButton = styled(Button)`
  background-color: ${p => p.theme.purple300};
  border: none;
  color: ${p => p.theme.white};
  width: 100%;
`;

const ButtonBar = styled('div')`
  display: flex;
  flex-direction: row;
  gap: 5px;
  justify-content: center;
`;
const ButtonContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export default DemoEndingModal;
