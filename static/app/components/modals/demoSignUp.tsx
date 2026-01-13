import {css} from '@emotion/react';
import styled from '@emotion/styled';

import habitsSuccessfulCustomer from 'sentry-images/spot/habitsSuccessfulCustomer.jpg';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import HighlightCornerContainer from 'sentry/components/highlightCornerModal';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {extraQueryParameter, urlAttachQueryParams} from 'sentry/utils/demoMode';

type Props = ModalRenderProps;

function DemoSignUpModal({closeModal}: Props) {
  const signupUrl = urlAttachQueryParams(
    'https://sentry.io/signup/',
    extraQueryParameter()
  );
  const demoUrl = urlAttachQueryParams(
    'https://sentry.io/_/demo/',
    extraQueryParameter()
  );

  return (
    <HighlightCornerContainer>
      <CloseButton
        icon={<IconClose />}
        size="xs"
        aria-label={t('Close')}
        onClick={() => {
          trackAnalytics('growth.demo_modal_clicked_close', {
            organization: null,
          });
          closeModal();
        }}
      />
      <div>
        <TrialCheckInfo>
          <Subheader>{t('Sign Up')}</Subheader>
          <h2>{t('Hey, like what you see?')}</h2>
          <p>
            {t(
              "Start your free trial, and create your first project to see what's broken in your code and how to fix it."
            )}
          </p>
        </TrialCheckInfo>
        <StyledButtonBar>
          <LinkButton
            priority="primary"
            href={signupUrl}
            onClick={() =>
              trackAnalytics('growth.demo_modal_clicked_signup', {
                organization: null,
              })
            }
          >
            {t('Start free trial')}
          </LinkButton>
          <LinkButton
            priority="default"
            href={demoUrl}
            onClick={() =>
              trackAnalytics('growth.demo_modal_clicked_demo', {
                organization: null,
              })
            }
          >
            {t('Request a demo')}
          </LinkButton>
        </StyledButtonBar>
      </div>
      <ImagePosition>
        <PositionRight src={habitsSuccessfulCustomer} />
      </ImagePosition>
    </HighlightCornerContainer>
  );
}

const TrialCheckInfo = styled('div')`
  padding: ${space(3)} 0;
  p {
    font-size: ${p => p.theme.fontSize.lg};
    margin: 0;
  }
  h2 {
    font-size: 2em;
  }
`;

export const modalCss = css`
  width: 100%;
  max-width: 1000px;
  [role='document'] {
    position: relative;
    padding: 70px 80px;
    overflow: visible;
    display: flex;
    gap: 30px;
  }
`;

const Subheader = styled('h4')`
  margin-bottom: ${space(2)};
  text-transform: uppercase;
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.tokens.interactive.link.accent.rest};
  font-size: ${p => p.theme.fontSize.md};
`;

const StyledButtonBar = styled(ButtonBar)`
  margin-top: ${space(2)};
  max-width: 250px;
`;

const ImagePosition = styled('div')`
  max-width: 360px;
  margin: auto;
`;

const PositionRight = styled('img')`
  border-radius: 0.5rem;
  pointer-events: none;
`;

const CloseButton = styled(Button)`
  position: absolute;
  top: -15px;
  right: -15px;
  height: 30px;
  width: 30px;
  border-radius: 50%;
  background: ${p => p.theme.tokens.background.primary};
  color: ${p => p.theme.tokens.content.primary};
`;

export default DemoSignUpModal;
