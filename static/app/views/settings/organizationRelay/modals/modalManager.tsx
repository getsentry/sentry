import {useEffect, useState} from 'react';
import omit from 'lodash/omit';
import {useMutation} from '@tanstack/react-query';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Relay} from 'sentry/types/relay';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

import {createTrustedRelaysResponseError} from './createTrustedRelaysResponseError';
import {Form} from './form';
import {Modal} from './modal';

type FormProps = React.ComponentProps<typeof Form>;
export type Values = FormProps['values'];

type Props = ModalRenderProps & {
  getData: (values: Values, savedRelays: Relay[]) => {trustedRelays: Relay[]};
  onSubmitSuccess: (organization: Organization) => void;
  orgSlug: Organization['slug'];
  savedRelays: Relay[];
  title: string;
  btnSaveLabel?: string;
  initialDisables?: FormProps['disables'];
  initialValues?: Partial<Values>;
  renderContent?: (form: React.ReactElement) => React.ReactElement;
};

const REQUIRED_VALUES: Array<keyof Values> = ['name', 'publicKey'];
const DEFAULT_VALUES: Values = {name: '', publicKey: '', description: ''};

export function ModalManager({
  getData,
  onSubmitSuccess,
  orgSlug,
  savedRelays,
  title,
  btnSaveLabel,
  initialDisables = {},
  initialValues = {},
  renderContent,
  ...modalProps
}: Props) {
  const [values, setValues] = useState<Values>({...DEFAULT_VALUES, ...initialValues});
  const [errors, setErrors] = useState<FormProps['errors']>({});
  const [disables] = useState<FormProps['disables']>(initialDisables);
  const [isFormValid, setIsFormValid] = useState(false);

  useEffect(() => {
    const valid = REQUIRED_VALUES.every(
      field => !!values[field].replace(/\s/g, '') && !errors[field]
    );
    setIsFormValid(valid);
  }, [values, errors]);

  const {mutate: save} = useMutation({
    mutationFn: (trustedRelays: Array<Omit<Relay, 'created' | 'lastModified'>>) =>
      fetchMutation<Organization>({
        url: getApiUrl('/organizations/$organizationIdOrSlug/', {
          path: {organizationIdOrSlug: orgSlug},
        }),
        method: 'PUT',
        data: {trustedRelays},
      }),
    onSuccess: response => {
      onSubmitSuccess(response);
      modalProps.closeModal();
    },
    onError: (error: any) => {
      const relayError = createTrustedRelaysResponseError(error);
      switch (relayError.type) {
        case 'invalid-key':
        case 'missing-key':
          setErrors(prev => ({...prev, publicKey: relayError.message}));
          break;
        case 'empty-name':
        case 'missing-name':
          setErrors(prev => ({...prev, name: relayError.message}));
          break;
        default:
          addErrorMessage(relayError.message);
      }
    },
  });

  const handleSave = () => {
    const trustedRelays = getData(values, savedRelays).trustedRelays.map(relay =>
      omit(relay, ['created', 'lastModified'])
    );
    save(trustedRelays);
  };

  const handleChange = <F extends keyof Values>(field: F, value: Values[F]) => {
    setValues(prev => ({...prev, [field]: value}));
    setErrors(prev => omit(prev, field) as FormProps['errors']);
  };

  const handleValidate = (field: keyof Values) => () => {
    const isEmpty = !values[field].replace(/\s/g, '');
    const hasError = !!errors[field];

    if (isEmpty && !hasError) {
      setErrors(prev => ({...prev, [field]: t('Field Required')}));
    } else if (!isEmpty && hasError) {
      setErrors(prev => omit(prev, field) as FormProps['errors']);
    }
  };

  const handleValidateKey = () => {
    const isKeyAlreadyTaken = savedRelays.find(r => r.publicKey === values.publicKey);

    if (isKeyAlreadyTaken && !errors.publicKey) {
      setErrors(prev => ({...prev, publicKey: t('Relay key already taken')}));
      return;
    }

    if (errors.publicKey) {
      setErrors(prev => omit(prev, 'publicKey') as FormProps['errors']);
    }

    handleValidate('publicKey')();
  };

  const form = (
    <Form
      isFormValid={isFormValid}
      onSave={handleSave}
      onChange={handleChange}
      onValidate={handleValidate}
      onValidateKey={handleValidateKey}
      errors={errors}
      values={values}
      disables={disables}
    />
  );

  const content = renderContent ? renderContent(form) : form;

  return (
    <Modal
      {...modalProps}
      title={title}
      onSave={handleSave}
      btnSaveLabel={btnSaveLabel}
      disabled={!isFormValid}
      content={content}
    />
  );
}
