import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Input from 'sentry/components/deprecatedforms/input';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = {
  onSubmit?: (email: string) => void;
};

export default function EmailForm({onSubmit}: Props) {
  const [disabledButton, setDisabledButton] = useState(true);
  return (
    <StyledForm
      onSubmit={event => {
        event.preventDefault();
        const email = (event.target as HTMLFormElement).email.value;
        if (onSubmit) {
          onSubmit(email);
        }
      }}
    >
      <Input
        type="email"
        name="email"
        autoComplete="email"
        placeholder={t('Work email')}
        onInput={event => {
          const email = (event.target as HTMLInputElement).value;
          setDisabledButton(!email);
        }}
      />
      <ButtonContainer>
        <Button
          type="submit"
          disabled={disabledButton}
          priority="primary"
          icon={<IconArrow direction="right" size="md" />}
        >
          {t('Enter Sandbox')}
        </Button>
      </ButtonContainer>
    </StyledForm>
  );
}

const ButtonContainer = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: end;
`;

const StyledForm = styled('form')`
  display: flex;
  flex-direction: column;
  padding: 0;
  gap: ${space(2)};
`;
