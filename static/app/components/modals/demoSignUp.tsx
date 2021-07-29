import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import HighlightModalContainer from 'app/components/highlightModalContainer';
import {t} from 'app/locale';
import space from 'app/styles/space';
import getCookie from 'app/utils/getCookie';

type Props = ModalRenderProps;

const ForcedTrialModal = ({closeModal}: Props) => {
  const email = localStorage.getItem('email');
  const queryParameter = email ? `?email=${email}` : '';
  const extraQueryString = getCookie('extra_query_string');
  // cookies that have = sign are quotes so extra quotes need to be removed
  const extraQuery = extraQueryString ? extraQueryString.replaceAll('"', '') : '';
  const emailSeparator = email ? '&' : '?';
  const getStartedSeparator = extraQueryString ? emailSeparator : '';
  const signupUrl = `https://sentry.io/signup/${queryParameter}${getStartedSeparator}${extraQuery}`;

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
          <Button priority="primary" href={signupUrl}>
            {t('Sign up now')}
          </Button>
          <Button priority="default" onClick={closeModal}>
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
  color: ${p => p.theme.purple300};
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

const StyledButtonBar = styled(ButtonBar)`
  margin-top: ${space(2)};
  max-width: fit-content;
`;

export default ForcedTrialModal;
