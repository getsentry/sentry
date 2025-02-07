import type {MouseEventHandler} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import PanelItem from 'sentry/components/panels/panelItem';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

function NewTokenHandler({
  token,
  handleGoBack,
}: {
  handleGoBack: MouseEventHandler;
  token: string;
}) {
  return (
    <div>
      <Alert type="warning" showIcon system>
        {t("Please copy this token to a safe place — it won't be shown again!")}
      </Alert>

      <PanelItem>
        <InputWrapper>
          <FieldGroupNoPadding
            label={t('Token')}
            help={t('You can only view this token when it was created.')}
            inline
            flexibleControlStateSize
          >
            <TextCopyInput aria-label={t('Generated token')}>{token}</TextCopyInput>
          </FieldGroupNoPadding>
        </InputWrapper>
      </PanelItem>

      <PanelItem>
        <ButtonWrapper>
          <Button onClick={handleGoBack} priority="primary">
            {t('Done')}
          </Button>
        </ButtonWrapper>
      </PanelItem>
    </div>
  );
}

const InputWrapper = styled('div')`
  flex: 1;
`;

const FieldGroupNoPadding = styled(FieldGroup)`
  padding: 0;
`;

const ButtonWrapper = styled('div')`
  margin-left: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: ${p => p.theme.fontSizeSmall};
  gap: ${space(1)};
`;

export default NewTokenHandler;
