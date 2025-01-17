import {useCallback} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import sandboxDemo from 'sentry-images/spot/sandbox.jpg';

import {IconArrow} from 'sentry/icons';
import {trackAnalytics} from 'sentry/utils/analytics';
import EmailForm from 'sentry/utils/demoMode/emailForm';
import {GetUTMData, UpdateTouches} from 'sentry/utils/demoMode/utm';
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
    async email => {
      const utmState = GetUTMData();
      if (closeModal) {
        closeModal();
      }

      // always save the email before the API call
      if (onAddedEmail) {
        onAddedEmail(email);
      }

      try {
        await api.requestPromise('/demo/email-capture/', {
          method: 'POST',
          data: {
            ...utmState.data,
            email,
          },
        });

        UpdateTouches(utmState);
      } catch (error) {
        onFailure();
      }
    },
    [api, closeModal, onFailure, onAddedEmail]
  );

  return (
    <div>
      <BackButton onClick={handleBackClick}>
        {<IconArrow direction="left" />} {'Go back'}
      </BackButton>
      <StartModal>
        <SignUpBody>
          <Subheader> Sandbox Demo </Subheader>
          <h2> Interactive Sandbox </h2>
          <p>
            Welcome to our digital showroom where you get to kick our proverbial tires. To
            see Sentry in action and get updates about the latest and greatest features,
            enter your email below.
          </p>
          <EmailForm onSubmit={handleSubmit} IconArrow={IconArrow} />
        </SignUpBody>
        <ImagePosition>
          <PositionRight src={sandboxDemo} />
        </ImagePosition>
      </StartModal>
    </div>
  );
}

const BackButton = styled('button')`
  border: 1px solid #e1dbd6;
  border-radius: 4px;
  background-color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 6px 8px;
  display: flex;
  gap: 5px;
`;

const ImagePosition = styled('div')`
  margin: auto;
  max-width: 400px;
`;

const PositionRight = styled('img')`
  border-radius: 0.5rem;
  pointer-events: none;
`;

const SignUpBody = styled('div')`
  padding: 20px 0;
  p {
    font-size: 16px;
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
  gap: 30px;
`;

const Subheader = styled('h4')`
  margin-bottom: 8px;
  text-transform: uppercase;
  font-weight: bold;
  color: #6c5fc7;
  font-size: 14px;
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
