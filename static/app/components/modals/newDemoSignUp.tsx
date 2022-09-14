import {css} from '@emotion/react';
import styled from '@emotion/styled';

import habitsSuccessfulCustomer from 'sentry-images/spot/habitsSuccessfulCustomer.jpg';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import HighlightCornerContainer from 'sentry/components/highlightCornerModal';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {
  extraQueryParameter,
  extraQueryParameterWithEmail,
  urlAttachQueryParams,
} from 'sentry/utils/demoMode';

type Props = ModalRenderProps;

const NewDemoSignUpModal = ({closeModal}: Props) => {
  const signupUrl = urlAttachQueryParams(
    'https://sentry.io/signup/',
    extraQueryParameterWithEmail()
  );
  const demoUrl = urlAttachQueryParams(
    'https://sentry.io/_/demo/',
    extraQueryParameter()
  );

  return (
    <HighlightCornerContainer>
      <div>
        <TrialCheckInfo>
          <Subheader>{t('Sign Up')}</Subheader>
          <h2>{t('Hey, like what you see?')}</h2>
          <p>
            {t(
              "Start your free trial, and create your first project to see what's broken in your code and how to fix it"
            )}
          </p>
        </TrialCheckInfo>
        <StyledButtonBar gap={1}>
          <Button
            priority="primary"
            href={signupUrl}
            onClick={() =>
              trackAdvancedAnalyticsEvent('growth.demo_modal_clicked_signup', {
                organization: null,
              })
            }
          >
            {t('Start free trial')}
          </Button>
          <Button
            priority="default"
            onClick={() => {
              trackAdvancedAnalyticsEvent('growth.demo_modal_clicked_continue', {
                organization: null,
              });
              closeModal();
            }}
          >
            {t('Keep exploring')}
          </Button>
          <Button
            priority="default"
            href={demoUrl}
            onClick={() =>
              trackAdvancedAnalyticsEvent('growth.demo_modal_clicked_docs', {
                organization: null,
              })
            }
          >
            {t('Request a demo')}
          </Button>
        </StyledButtonBar>
      </div>
      <div>
        <PositionRight src={habitsSuccessfulCustomer} />
      </div>
    </HighlightCornerContainer>
  );
};

const TrialCheckInfo = styled('div')`
  padding: ${space(3)} 0;
  p {
    font-size: ${p => p.theme.fontSizeLarge};
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
    overflow: hidden;
    display: flex;
    gap: ${space(3)};
  }
`;

const Subheader = styled('h4')`
  margin-bottom: ${space(2)};
  text-transform: uppercase;
  font-weight: bold;
  color: ${p => p.theme.purple300};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StyledButtonBar = styled(ButtonBar)`
  margin-top: ${space(2)};
`;

const PositionRight = styled('img')`
  border-radius: 0.5rem;
  pointer-events: none;
`;

export default NewDemoSignUpModal;
