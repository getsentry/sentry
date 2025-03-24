import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = {
  onSubmit?: (email: string) => Promise<void>;
};

export default function EmailForm({onSubmit}: Props) {
  const [disabledButton, setDisabledButton] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <StyledForm
      onSubmit={async event => {
        setIsSubmitting(true);
        event.preventDefault();
        const email = (event.target as HTMLFormElement).email.value;
        if (onSubmit) {
          await onSubmit(email);
        }
        setIsSubmitting(false);
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
          busy={isSubmitting}
          priority="primary"
          icon={
            isSubmitting ? (
              <LoadingIndicator mini />
            ) : (
              <IconArrow direction="right" size="md" />
            )
          }
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
