import {Fragment} from 'react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';

type Props = ModalRenderProps & {
  linkText: string;
};

function NavigateToExternalLinkModal({Body, closeModal, Header, linkText = ''}: Props) {
  return (
    <Fragment>
      <Header closeButton>
        <HeaderContainer>
          <IconWarning size="sm" color="warningText" />
          <h2>{t('Leaving Sentry Warning')}</h2>
        </HeaderContainer>
      </Header>
      <Body>
        <p>
          {t(
            'Heads up. You're leaving Sentry and will be redirected to the following external website:'
          )}
        </p>
        <p>{linkText}</p>
        <p />
      </Body>
      <ButtonContainer>
        <ButtonBar>
          <Button
            priority="primary"
            onClick={() => {
              window.open(linkText, '_blank', 'noreferrer');
              closeModal();
            }}
          >
            {t('Continue')}{' '}
          </Button>
          <Button
            priority="default"
            onClick={() => {
              closeModal();
            }}
          >
            {t('Cancel')}
          </Button>
        </ButtonBar>
      </ButtonContainer>
    </Fragment>
  );
}

export default NavigateToExternalLinkModal;
export {NavigateToExternalLinkModal};
// const ButtonWrapper = styled('div')`
//   display: flex;
//   justify-content: flex-end;
// `;

const ButtonContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const HeaderContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const ButtonBar = styled('div')`
  display: flex;
  flex-direction: row;
  gap: 5px;
  justify-content: end;
`;
