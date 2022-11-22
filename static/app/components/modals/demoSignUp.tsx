import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import HighlightModalContainer from 'sentry/components/highlightModalContainer';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {extraQueryParameterWithEmail, urlAttachQueryParams} from 'sentry/utils/demoMode';

type Props = ModalRenderProps;

const DemoSignUpModal = ({closeModal}: Props) => {
  const signupUrl = urlAttachQueryParams(
    'https://sentry.io/signup/',
    extraQueryParameterWithEmail()
  );

  return (
    <HighlightModalContainer>
      <div>
        <TrialCheckInfo>
          <Subheader>{t('Sandbox Signup')}</Subheader>
          <h2>{t('Hey, love what you see?')}</h2>
          <p>
            {t(
              'Sign up now to setup your own project to see problems within your code and learn how to quickly improve your project.'
            )}
          </p>
        </TrialCheckInfo>
        <StyledButtonBar gap={2}>
          <Button
            priority="primary"
            href={signupUrl}
            onClick={() =>
              trackAdvancedAnalyticsEvent('growth.demo_modal_clicked_signup', {
                organization: null,
              })
            }
          >
            {t('Sign up now')}
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
            {t('Keep Exploring')}
          </Button>
        </StyledButtonBar>
      </div>
    </HighlightModalContainer>
  );
};

const TrialCheckInfo = styled('div')`
  padding: ${space(3)} 0;
  p {
    font-size: ${p => p.theme.fontSizeMedium};
    margin: 0;
  }
  h2 {
    font-size: 1.5em;
  }
`;

export const modalCss = css`
  width: 100%;
  max-width: 730px;
  [role='document'] {
    position: relative;
    padding: 70px 80px;
    overflow: hidden;
  }
`;

const Subheader = styled('h4')`
  margin-bottom: ${space(2)};
  text-transform: uppercase;
  font-weight: bold;
  color: ${p => p.theme.activeText};
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

const StyledButtonBar = styled(ButtonBar)`
  margin-top: ${space(2)};
  max-width: fit-content;
`;

export default DemoSignUpModal;
