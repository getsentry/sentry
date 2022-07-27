import React, {useEffect, useRef} from 'react';
import {browserHistory} from 'react-router';
import Editor from '@monaco-editor/react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import Feature from 'sentry/components/acl/feature';
import AsyncComponent from 'sentry/components/asyncComponent';
import Button from 'sentry/components/button';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import FormModel from 'sentry/components/forms/model';
import {Field} from 'sentry/components/forms/type';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {t, tct} from 'sentry/locale';
import {SentryFunction} from 'sentry/types';
import useApi from 'sentry/utils/useApi';

type Props = {
  sentryFunction?: SentryFunction;
} & WrapperProps;
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
  const api = useApi();
  const form = useRef(new FormModel());
  const {orgId, functionSlug} = props.params;
  const {sentryFunction} = props;
  const method = functionSlug ? 'PUT' : 'POST';
  let endpoint = `/organizations/${orgId}/functions/`;
  if (functionSlug) {
    endpoint += `${functionSlug}/`;
  }
  const defaultCode = sentryFunction
    ? sentryFunction.code
    : `exports.yourFunction = (req, res) => {
    let message = req.query.message || req.body.message || 'Hello World!';
    console.log('Query: ' + req.query);
    console.log('Body: ' + req.body);
    res.status(200).send(message);
  };`;

  useEffect(() => {
    form.current.setValue('code', defaultCode);
  }, [defaultCode]);

  const handleSubmitError = err => {
    let errorMessage = t('Unknown Error');
    if (err.status >= 400 && err.status < 500) {
      errorMessage = err?.responseJSON.detail ?? errorMessage;
    }
    addErrorMessage(errorMessage);
  };

  const handleSubmitSuccess = data => {
    addSuccessMessage(t('Sentry Function successfully saved.', data.name));
    const baseUrl = `/settings/${orgId}/developer-settings/sentry-functions/`;
    // TODO: should figure out where to redirect this
    const url = `${baseUrl}${data.slug}/`;
    if (sentryFunction) {
      addSuccessMessage(t('%s successfully saved.', data.name));
    } else {
      addSuccessMessage(t('%s successfully created.', data.name));
    }
    browserHistory.push(url);
  };

  function handleEditorChange(value, _event) {
    form.current.setValue('code', value);
  }

  async function handleDelete() {
    try {
      await api.requestPromise(endpoint, {
        method: 'DELETE',
      });
      addSuccessMessage(t('Sentry Function successfully deleted.'));
      // TODO: Not sure where to redirect to, so just redirect to the unbuilt Sentry Functions page
      browserHistory.push(`/settings/${orgId}/developer-settings/sentry-functions/`);
    } catch (err) {
      addErrorMessage(t(err.responseJSON));
    }
  }

  return (
    <div>
      <Feature features={['organizations:sentry-functions']}>
        <h1>{t('Sentry Function Details')}</h1>
        <h2>
          {sentryFunction
            ? tct('Editing [name]', {name: sentryFunction.name})
            : t('New Function')}
        </h2>
        <Form
          apiMethod={method}
          apiEndpoint={endpoint}
          model={form.current}
          onPreSubmit={() => {
            addLoadingMessage(t('Saving changes..'));
          }}
          initialData={{
            ...props.sentryFunction,
          }}
          onSubmitError={handleSubmitError}
          onSubmitSuccess={handleSubmitSuccess}
        >
          <JsonForm forms={[{title: t('Sentry Function Details'), fields: formFields}]} />
          <Panel>
            <PanelHeader>Write your Code Below</PanelHeader>
            <PanelBody>
              <Editor
                height="40vh"
                theme="light"
                defaultLanguage="javascript"
                defaultValue={defaultCode}
                onChange={handleEditorChange}
                options={{
                  minimap: {
                    enabled: false,
                  },
                  scrollBeyondLastLine: false,
                }}
              />
            </PanelBody>
          </Panel>
        </Form>
        {sentryFunction && (
          <Button
            onClick={handleDelete}
            title={t('Delete Sentry Function')}
            aria-label={t('Delete Sentry Function')}
            type="button"
            priority="danger"
          >
            {t('Delete Sentry Function')}
          </Button>
        )}
      </Feature>
    </div>
  );
}

type WrapperState = {
  sentryFunction?: SentryFunction;
} & AsyncComponent['state'];

type WrapperProps = {
  params: {orgId: string; functionSlug?: string};
} & AsyncComponent['props'];

class SentryFunctionsWrapper extends AsyncComponent<WrapperProps, WrapperState> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {functionSlug, orgId} = this.props.params;
    if (functionSlug) {
      return [['sentryFunction', `/organizations/${orgId}/functions/${functionSlug}/`]];
    }
    return [];
  }
  renderBody() {
    return (
      <SentryFunctionDetails sentryFunction={this.state.sentryFunction} {...this.props} />
    );
  }
}

export default SentryFunctionsWrapper;
