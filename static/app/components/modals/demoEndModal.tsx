import {useCallback, useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {fetchGuides} from 'sentry/actionCreators/guides';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button, LinkButton} from 'sentry/components/button';
import ModalTask from 'sentry/components/onboardingWizard/modalTask';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useNavigate} from 'sentry/utils/useNavigate';

// tour is a string that tells which tour the user is completing in the walkthrough
type Props = ModalRenderProps & {orgSlug: Organization['slug'] | null; tour: string};

export default function DemoEndingModal({tour, closeModal, CloseButton, orgSlug}: Props) {
  const navigate = useNavigate();

  const {cardTitle, body, path} = useMemo(() => {
    switch (tour) {
      case 'issues':
        return {
          cardTitle: t('Issues Tour'),
          body: t(
            'Thank you for completing the Issues tour. Learn about other Sentry features by starting another tour.'
          ),
          guides: ['issues_v3', 'issue_stream_v3'],
          path: `/organizations/${orgSlug}/issues/`,
        };

      case 'performance':
        return {
          cardTitle: t('Performance Tour'),
          body: t(
            'Thank you for completing the Performance tour. Learn about other Sentry features by starting another tour.'
          ),
          guides: ['performance', 'transaction_summary', 'transaction_details_v2'],
          path: `/organizations/${orgSlug}/performance/`,
        };

      case 'releases':
        return {
          cardTitle: t('Releases Tour'),
          body: t(
            'Thank you for completing the Releases tour. Learn about other Sentry features by starting another tour.'
          ),
          guides: ['releases_v2', 'react-release', 'release-details_v2'],
          path: `/organizations/${orgSlug}/releases/`,
        };

      case 'tabs':
        return {
          cardTitle: t('Check out the different tabs'),
          body: t(
            'Thank you for checking out the different tabs. Learn about other Sentry features by starting another tour.'
          ),
          guides: ['sidebar_v2'],
          path: `/organizations/${orgSlug}/projects/`,
        };

      default:
        return {
          cardTitle: '',
          body: '',
          guides: [''],
          path: '',
        };
    }
  }, [orgSlug, tour]);

  const navigation = useCallback(() => {
    navigate(path);
  }, [path, navigate]);

  function handleRestart() {
    trackAnalytics('growth.end_modal_restart_tours', {
      organization: null,
    });

    closeModal?.();

    fetchGuides();

    navigation();
  }

  const handleMoreTours = () => {
    closeModal?.();
    SidebarPanelStore.togglePanel(SidebarPanelKey.ONBOARDING_WIZARD);
    trackAnalytics('growth.end_modal_more_tours', {
      organization: null,
    });
  };

  return (
    <EndModal>
      <CloseButton
        size="zero"
        onClick={() => {
          trackAnalytics('growth.end_modal_close', {
            organization: null,
          });
          if (closeModal) {
            closeModal();
          }
        }}
        icon={<IconClose size="xs" />}
      />
      <ModalHeader>
        <h2> {t('Tour Complete')} </h2>
      </ModalHeader>
      <ModalTask title={cardTitle} />
      <ModalHeader>{body}</ModalHeader>
      <ButtonContainer>
        <LinkButton
          priority="primary"
          external
          href={'https://sentry.io/signup/'}
          onClick={() => {
            trackAnalytics('growth.end_modal_signup', {
              organization: null,
            });
          }}
        >
          {t('Sign up for Sentry')}
        </LinkButton>
        <ButtonBar>
          <Button onClick={handleMoreTours}>{t('More Tours')} </Button>
          <Button onClick={handleRestart}>{t('Restart Tour')}</Button>
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

const ModalHeader = styled('div')`
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
