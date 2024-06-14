import {Fragment} from 'react';
import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import Alert from 'sentry/components/alert';
import FieldFromConfig from 'sentry/components/forms/fieldFromConfig';
import Form from 'sentry/components/forms/form';
import type {Field} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import theme from 'sentry/utils/theme';

interface RemoteConfigCreateFeatureModal extends ModalRenderProps {
  createFeature: (key: string, value: string) => void;
  isValid: (key: string) => boolean;
}

const formFields: Field[] = [
  {
    name: 'key',
    type: 'string',
    required: true,
    label: t('Feature Key'),
  },
  {
    name: 'value',
    type: 'string',
    required: true,
    label: t('Feature Value'),
  },
];

export default function RemoteConfigCreateFeatureModal({
  Body,
  Header,
  Footer: _Footer,
  closeModal,
  createFeature,
  isValid,
}: RemoteConfigCreateFeatureModal) {
  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Add Remote Config Feature')}</h4>
      </Header>
      <Body>
        <Alert type="warning" showIcon>
          {t(
            'Feature keys and values are publicly readable with your DSN. Do NOT store secrets or sensitive information here.'
          )}
        </Alert>
        <Form
          submitLabel={t('Add')}
          cancelLabel={t('Cancel')}
          onCancel={closeModal}
          onSubmit={(data, onSubmitSuccess, onSubmitError) => {
            if (isValid(data.key)) {
              closeModal();
              onSubmitSuccess(data);
              createFeature(data.key, data.value);
            } else {
              onSubmitError('Invalid key');
            }
          }}
        >
          {formFields.map(field => (
            <FieldFromConfig
              key={field.name}
              field={field}
              inline={false}
              stacked
              flexibleControlStateSize
            />
          ))}
        </Form>
      </Body>
    </Fragment>
  );
}

export const modalCss = css`
  @media (min-width: ${theme.breakpoints.small}) {
    width: 80%;
  }
`;
