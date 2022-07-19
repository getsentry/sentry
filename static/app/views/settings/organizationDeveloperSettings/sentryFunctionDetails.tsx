import {useRef} from 'react';
import Editor from '@monaco-editor/react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import Feature from 'sentry/components/acl/feature';
import AsyncComponent from 'sentry/components/asyncComponent';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import FormModel from 'sentry/components/forms/model';
import {Field} from 'sentry/components/forms/type';
import {t} from 'sentry/locale';

// type Props = RouteComponentProps<{orgId: string; functionSlug?: string}, {}>;
// type Props = WrapperProps & {orgId: string; functionSlug?: string};
type Props = WrapperProps;
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
  {
    name: 'overview',
    type: 'string',
    placeholder: 'e.g. This Sentry Function does something useful',
    label: 'Overview',
    help: 'A short description of your Sentry Function.',
  },
];

function SentryFunctionDetails(props: Props) {
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

  const editorRef = useRef(null);

  function handleEditorDidMount(editor) {
    editorRef.current = editor;
  }
  function updateCode() {
    if (editorRef.current === null) {
      form.current.setValue('code', editorRef.current?.getValue());
    }
  }

  return (
    <div>
      <Feature features={['organizations:sentry-functions']}>
        <h1>{t('Sentry Function Details')}</h1>
        <h2>{props.params.orgId}</h2>
        <Form
          apiMethod={method}
          apiEndpoint={endpoint}
          model={form.current}
          onPreSubmit={() => {
            updateCode();
            addLoadingMessage(t('Saving changes..'));
          }}
          onSubmitError={handleSubmitError}
          onSubmitSuccess={handleSubmitSuccess}
        >
          <JsonForm forms={[{title: t('Sentry Function Details'), fields: formFields}]} />
        </Form>
        <Editor
          height="80vh"
          defaultLanguage="python"
          defaultValue="// some comment"
          onMount={handleEditorDidMount}
          options={{
            minimap: {
              enabled: false,
            },
          }}
        />
      </Feature>
    </div>
  );
}

type WrapperState = {} & AsyncComponent['state'];

type WrapperProps = {
  params: {orgId: string; functionSlug?: string};
} & AsyncComponent['props'];

class SentryFunctionsWrapper extends AsyncComponent<WrapperProps, WrapperState> {
  renderBody() {
    return <SentryFunctionDetails {...this.props} />;
  }
}

export default SentryFunctionsWrapper;
