import {RouteComponentProps} from 'react-router';

import {addLoadingMessage} from 'sentry/actionCreators/indicator';
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
];

class SentryFunctionFormModel extends FormModel {
  getTransformedData(): {} {
    return super.getTransformedData() as Record<string, any>;
  }
}

export default function sentryFunctionDetails(props: Props) {
  const form = new SentryFunctionFormModel();
  const {orgId, functionSlug} = props.params;
  const method = functionSlug ? 'PUT' : 'POST';
  const endpoint = `/organizations/${orgId}/functions/`;
  return (
    <div>
      <h1>Sentry Function Details</h1>
      <h2>{props.params.orgId}</h2>
      <Form
        apiMethod={method}
        apiEndpoint={endpoint}
        model={form}
        onPreSubmit={() => addLoadingMessage(t('Saving changes..'))}
      >
        <JsonForm forms={[{title: 'Sentry Function Details', fields: formFields}]} />
      </Form>
    </div>
  );
}
