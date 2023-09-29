import {FormEvent, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {getCurrentHub} from '@sentry/react';

interface FeedbackFormProps {
  descriptionPlaceholder: string;
  onClose: () => void;
  onSubmit: (data: {comment: string; email: string; name: string}) => void;
  sendButtonText: string;
}

const retrieveStringValue = (formData: FormData, key: string) => {
  const value = formData.get(key);
  if (typeof value === 'string') {
    return value.trim();
  }
  return '';
};

export function FeedbackForm({
  descriptionPlaceholder,
  sendButtonText,
  onClose,
  onSubmit,
}: FeedbackFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [hasDescription, setHasDescription] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);

    onSubmit({
      name: retrieveStringValue(formData, 'name'),
      email: retrieveStringValue(formData, 'email'),
      comment: retrieveStringValue(formData, 'comment'),
    });
  };

  const user = getCurrentHub().getScope()?.getUser();

  return (
    <Form ref={formRef} onSubmit={handleSubmit}>
      <Input
        type="hidden"
        name="name"
        aria-hidden
        defaultValue={user?.username || user?.name}
      />
      <Input type="hidden" name="email" defaultValue={user?.email} hidden aria-hidden />
      <Label htmlFor="sentry-feedback-comment">
        <div>Description</div>
        <TextArea
          autoFocus
          rows={5}
          onChange={event => {
            setHasDescription(!!event.target.value);
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' && event.ctrlKey) {
              formRef.current?.requestSubmit();
            }
          }}
          id="sentry-feedback-comment"
          name="comment"
          placeholder={descriptionPlaceholder}
        />
      </Label>
      <ButtonGroup>
        <SubmitButton
          type="submit"
          disabled={!hasDescription}
          aria-disabled={!hasDescription}
        >
          {sendButtonText}
        </SubmitButton>
        <CancelButton type="button" onClick={onClose}>
          Cancel
        </CancelButton>
      </ButtonGroup>
    </Form>
  );
}

const Form = styled('form')`
  display: grid;
  overflow: auto;
  flex-direction: column;
  gap: 16px;
  padding: 0;
`;

const Label = styled('label')`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0px;
`;

const inputStyles = css`
  box-sizing: border-box;
  border: var(--sentry-feedback-border);
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  padding: 6px 12px;
  &:focus {
    border-color: rgba(108, 95, 199, 1);
  }
`;

const Input = styled('input')`
  ${inputStyles}
`;

const TextArea = styled('textarea')`
  ${inputStyles}
  resize: vertical;
`;

const ButtonGroup = styled('div')`
  display: grid;
  gap: 8px;
  margin-top: 8px;
`;

const BaseButton = styled('button')`
  border: var(--sentry-feedback-border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  padding: 6px 16px;
`;

const SubmitButton = styled(BaseButton)`
  background-color: rgba(108, 95, 199, 1);
  border-color: rgba(108, 95, 199, 1);
  color: #fff;
  &:hover {
    background-color: rgba(88, 74, 192, 1);
  }

  &[disabled] {
    opacity: 0.6;
    pointer-events: none;
  }
`;

const CancelButton = styled(BaseButton)`
  background-color: transparent;
  color: var(--sentry-feedback-fg-color);
  font-weight: 500;
  &:hover {
    background-color: var(--sentry-feedback-bg-accent-color);
  }
`;
