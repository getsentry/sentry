import type {MouseEventHandler} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import PanelItem from 'sentry/components/panels/panelItem';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

function NewSecretHandler({
  secret,
  onGoBack,
}: {
  onGoBack: MouseEventHandler;
  secret: string;
}) {
  return (
    <div>
      <Alert type="warning" showIcon system>
        {t('The secret has been posted.')}
      </Alert>

      <PanelItem>
        <InputWrapper>
          <FieldGroupNoPadding
            label={t('Secret')}
            help={t(
              'The secret should not be shared and will not be retrievable once you leave this page.'
            )}
            inline
            flexibleControlStateSize
          >
            <TextCopyInput aria-label={t('Secret')}>{secret}</TextCopyInput>
          </FieldGroupNoPadding>
        </InputWrapper>
      </PanelItem>

      <PanelItem>
        <ButtonWrapper>
          <Button onClick={onGoBack} priority="primary">
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

export default NewSecretHandler;
