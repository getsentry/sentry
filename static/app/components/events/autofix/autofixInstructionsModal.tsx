import TextareaAutosize from 'react-autosize-textarea';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import Form from 'sentry/components/forms/form';
import FormField from 'sentry/components/forms/formField';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface AutofixContextModalProps extends ModalRenderProps {
  triggerAutofix: (value: string) => void;
}

export function AutofixInstructionsModal({
  Header,
  Footer,
  closeModal,
  triggerAutofix,
}: AutofixContextModalProps) {
  return (
    <Form
      hideFooter
      onSubmit={data => {
        triggerAutofix(data.instruction ?? '');
        closeModal();
      }}
    >
      <Header>
        <h4>{t('Give the Autofix Agent Some Instructions')}</h4>
      </Header>

      <div>
        <FullSizeFieldGroup name="instruction" inline={false} flexibleControlStateSize>
          {({id, name, onChange, onBlur, disabled, value}) => (
            <FullSizeTextAreaField
              id={id}
              name={name}
              aria-label={t('Provide instructions')}
              placeholder={t(
                'This error seems to be caused by ... go look at path/file to make sure it does …'
              )}
              onChange={e => onChange((e.target as HTMLTextAreaElement).value, e)}
              disabled={disabled}
              value={value}
              onBlur={onBlur}
              maxRows={20}
              autoFocus
              style={{resize: 'none'}}
            />
          )}
        </FullSizeFieldGroup>
      </div>
      <Footer>
        <FooterButtons>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button priority="primary" type="submit">
            {t("Let's go!")}
          </Button>
        </FooterButtons>
      </Footer>
    </Form>
  );
}

const FullSizeTextAreaField = styled(TextareaAutosize)`
  padding: 0;
  width: 100%;
  border: none;
  resize: none;

  &:focus {
    outline: none;
  }
`;

const FullSizeFieldGroup = styled(FormField)`
  padding: 0;
`;

const FooterButtons = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-auto-flow: column;
  justify-content: flex-end;
  flex: 1;
`;
