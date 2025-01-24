import {useCallback} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import sandboxDemo from 'sentry-images/spot/sandbox.jpg';

import {Button} from 'sentry/components/button';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import EmailForm from 'sentry/utils/demoMode/emailForm';
import {getUTMState, updateTouches} from 'sentry/utils/demoMode/utm';
import theme from 'sentry/utils/theme';
import useApi from 'sentry/utils/useApi';

type Props = {
  closeModal: () => void;
  onAddedEmail: (email: string) => void;
  onFailure: () => void;
};

export default function Modal({onAddedEmail, closeModal, onFailure}: Props) {
  const api = useApi();

  const handleBackClick = () => {
    // go back to the referrer or the welcome page
    let newUrl = 'https://sentry.io/welcome/';
    const {referrer} = window.document;
    // if we have a referrer and the URL is different than our current origin
    // then we can send the back there
    // otherwise, send them to welcome page
    if (referrer && !referrer.startsWith(window.location.origin)) {
      newUrl = referrer;
    }

    // track this event but if it errors out, proceed
    try {
      trackAnalytics('growth.email_form_pressed_back', {
        organization: null,
      });
    } catch {
      // do nothing
    }

    window.location.href = newUrl;
  };

  const handleSubmit = useCallback(
    async (email: string) => {
      const utmState = getUTMState();

      // always save the email before the API call
      if (onAddedEmail) {
        onAddedEmail(email);
      }

      try {
        await api.requestPromise('/internal/demo/email-capture/', {
          method: 'POST',
          data: {
            ...utmState.data,
            email,
          },
        });

        updateTouches(utmState);
      } catch (error) {
        onFailure();
      }

      closeModal();
    },
    [api, closeModal, onFailure, onAddedEmail]
  );

  return (
    <div>
      <BackButtonWrapper>
        <Button onClick={handleBackClick} icon={<IconArrow direction="left" />} size="sm">
          {t('Go back')}
        </Button>
      </BackButtonWrapper>
      <StartModal>
        <SignUpBody>
          <Subheader> {t('Sandbox Demo')} </Subheader>
          <h2> {t('Interactive Sandbox')} </h2>
          <p>
            {t(
              'Welcome to our digital showroom where you get to kick our proverbial tires. To see Sentry in action and get updates about the latest and greatest features, enter your email below.'
            )}
          </p>
          <EmailForm onSubmit={handleSubmit} />
        </SignUpBody>
        <ImagePosition>
          <PositionRight src={sandboxDemo} />
        </ImagePosition>
      </StartModal>
    </div>
  );
}

const ImagePosition = styled('div')`
  margin: auto;
  max-width: 400px;
`;

const PositionRight = styled('img')`
  border-radius: ${space(1)};
  pointer-events: none;
`;

const BackButtonWrapper = styled('div')`
  padding-bottom: ${space(2)};
`;

const SignUpBody = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};

  padding: 0;
  p {
    font-size: ${theme.fontSizeLarge};
    margin: 0;
  }
  h2 {
    font-size: 2em;
  }
  max-width: 400px;
`;

const StartModal = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${space(4)};
`;

const Subheader = styled('h4')`
  margin-bottom: ${space(1)};
  text-transform: uppercase;
  font-weight: bold;
  color: ${theme.purple300};
  font-size: ${theme.fontSizeMedium};
`;

export const modalCss = css`
  width: 100%;
  max-width: 1000px;
  [role='document'] {
    position: relative;
    padding: 50px 60px;
    overflow: hidden;
  }
`;
