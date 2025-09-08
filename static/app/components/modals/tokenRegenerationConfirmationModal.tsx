import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t} from 'sentry/locale';

export interface TokenRegenerationConfirmationModalProps {
  token: string;
}

type Props = ModalRenderProps & TokenRegenerationConfirmationModalProps;

function TokenRegenerationConfirmationModal({Header, Body, token}: Props) {
  return (
    <Fragment>
      <Header closeButton>
        <h5>{t('Token created')}</h5>
      </Header>
      <Body>
        <Wrapper>
          <TokenRow>
            <StyledTextCopyInput
              style={{minWidth: '230px'}}
              aria-label={t('Prevent Variable')}
            >
              SENTRY_PREVENT_TOKEN
            </StyledTextCopyInput>
            <StyledTextCopyInput style={{minWidth: '310px'}} aria-label={t('Token')}>
              {token}
            </StyledTextCopyInput>
          </TokenRow>
        </Wrapper>
      </Body>
    </Fragment>
  );
}

export default TokenRegenerationConfirmationModal;

const Wrapper = styled('div')`
  margin-bottom: ${p => p.theme.space.xl};
`;

const TokenRow = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${p => p.theme.space.md};
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
