import React from 'react';
import styled from '@emotion/styled';

type Props = {
  IconArrow: any;
  onSubmit?: (email: string) => void;
};

export default function EmailForm({onSubmit, IconArrow}: Props) {
  const [disabledButton, setDisabledButton] = React.useState(true);
  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        const email = (event.target as HTMLFormElement).email.value;
        if (onSubmit) {
          onSubmit(email);
        }
      }}
    >
      <EmailFormInput
        type="email"
        name="email"
        autoComplete="email"
        placeholder="Work email"
        onInput={event => {
          const email = (event.target as HTMLInputElement).value;
          setDisabledButton(!email);
        }}
      />
      <ButtonContainer>
        <SubmitButton type="submit" disabled={disabledButton}>
          {<IconArrow direction="right" size="md" />}
          {'Enter Sandbox'}
        </SubmitButton>
      </ButtonContainer>
    </form>
  );
}

const ButtonContainer = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: end;
`;

const Button = styled('button')`
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 16px;
  margin-top: 10px;
`;

const SubmitButton = styled(Button)`
  background-color: #6c5fc7;
  color: white;
  font-weight: bold;
  white-space: nowrap;
  padding: 10px 10px;
  display: flex;
  align-items: center;
  gap: 5px;
  :disabled {
    background-color: #a79fdd;
    cursor: not-allowed;
  }
`;

const EmailFormInput = styled('input')`
  border: 1px solid #c6becf;
  box-sizing: border-box;
  box-shadow: inset 0px 2px 1px rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  font-size: 15px;
  padding: 8px;
  width: 100%;
  margin-top: 1.5rem;
`;
