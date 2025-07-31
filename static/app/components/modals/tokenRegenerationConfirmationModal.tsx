import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = ModalRenderProps;

function TokenRegenerationConfirmationModal({Header, Body, Footer, closeModal}: Props) {
  return (
    <Fragment>
      <Header closeButton>
        <h5>{t('Token created')}</h5>
      </Header>
      <Body>
        <Wrapper>
          <Alert.Container>
            <Alert type="warning">
              {t(`Please copy this token to a safe place - it won't be shown again.`)}
            </Alert>
          </Alert.Container>
          <TokenRow>
            <StyledTextCopyInput style={{minWidth: '230px'}}>
              SENTRY_PREVENT_TOKEN
            </StyledTextCopyInput>
            <StyledTextCopyInput style={{minWidth: '310px'}}>
              91b57316-b1ff-4884-8d55-92b9936a05a3
            </StyledTextCopyInput>
          </TokenRow>
        </Wrapper>
      </Body>

      <Footer>
        <Button onClick={closeModal} priority="primary">
          {t('Done')}
        </Button>
      </Footer>
    </Fragment>
  );
}

export default TokenRegenerationConfirmationModal;

const Wrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const TokenRow = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
`;

const StyledTextCopyInput = styled(TextCopyInput)`
  box-shadow: none;
  input {
    height: 52px;
    background: #2b2233;
    color: #f0ecf3;
    font-size: 12px;
  }
`;
