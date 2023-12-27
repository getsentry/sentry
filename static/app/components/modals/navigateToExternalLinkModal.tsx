import {Fragment} from 'react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button, LinkButton} from 'sentry/components/button';
import {t} from 'sentry/locale';

type Props = ModalRenderProps & {
  linkText: string;
};

function NavigateToExternalLinkModal({Body, closeModal, Header, linkText = ''}: Props) {
  return (
    <Fragment>
      <Header closeButton>
        <h2>{t('Heads up')}</h2>
      </Header>
      <Body>
        <p>
          {t(
            "You're leaving Sentry and will be redirected to the following external website:"
          )}
        </p>
        <ParagraphContainer>{linkText}</ParagraphContainer>
        <p />
      </Body>
      <ButtonContainer>
        <ButtonBar>
          <LinkButton priority="primary" href={linkText} external>
            {t('Continue')}{' '}
          </LinkButton>
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

const ParagraphContainer = styled('p')`
  word-break: break-all;
  white-space: normal;
`;

const ButtonBar = styled('div')`
  display: flex;
  flex-direction: row;
  gap: 5px;
  justify-content: end;
`;
