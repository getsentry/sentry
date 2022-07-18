import {useRef} from 'react';
import {RouteComponentProps} from 'react-router';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import Feature from 'sentry/components/acl/feature';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import FormModel from 'sentry/components/forms/model';
import {Field} from 'sentry/components/forms/type';
import {t} from 'sentry/locale';

type Props = RouteComponentProps<{orgId: string; functionSlug?: string}, {}>;
// type State = AsyncView['state'] & {
//   sentryFunction: SentryFunction | null;
// };
const formFields: Field[] = [
  {
    name: 'name',
    type: 'string',
    required: true,
    placeholder: 'e.g. My Sentry Function',
    label: 'Name',
    help: 'Human readable name of your Sentry Function',
  },
  {
    name: 'author',
    type: 'string',
    placeholder: 'e.g. Acme Software',
    label: 'Author',
    help: 'The company or person who built and maintains this Sentry Function.',
  },
  // TODO: Add overview field in database and in backend endpoint
  // {
  //   name: 'overview',
  //   type: 'string',
  //   placeholder: 'e.g. This Sentry Function does something useful',
  //   label: 'Overview',
  //   help: 'A short description of your Sentry Function.',
  // },
];

export default function SentryFunctionDetails(props: Props) {
  const form = useRef(new FormModel());
  const {orgId, functionSlug} = props.params;
  const method = functionSlug ? 'PUT' : 'POST';
  const endpoint = `/organizations/${orgId}/functions/`;
  const handleSubmitError = err => {
    let errorMessage = t('Unknown Error');
    if (err.status >= 400 && err.status < 500) {
      errorMessage = err?.responseJSON.detail ?? errorMessage;
    }
    addErrorMessage(errorMessage);
  };

  const handleSubmitSuccess = data => {
    addSuccessMessage(t('Sentry Function successfully saved.', data.name));
  };

  return (
    <div>
      <Feature features={['organizations:sentry-functions']}>
        <h1>{t('Sentry Function Details')}</h1>
        <h2>{props.params.orgId}</h2>
        <Form
          apiMethod={method}
          apiEndpoint={endpoint}
          model={form.current}
          onPreSubmit={() => addLoadingMessage(t('Saving changes..'))}
          onSubmitError={handleSubmitError}
          onSubmitSuccess={handleSubmitSuccess}
        >
          <JsonForm forms={[{title: t('Sentry Function Details'), fields: formFields}]} />
        </Form>
      </Feature>
    </div>
  );
}
