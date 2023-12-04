import {useEffect, useState} from 'react';
import {browserHistory} from 'react-router';
import Editor from '@monaco-editor/react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import Feature from 'sentry/components/acl/feature';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import FormModel from 'sentry/components/forms/model';
import {Field} from 'sentry/components/forms/types';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {Organization, SentryFunction} from 'sentry/types';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withOrganization from 'sentry/utils/withOrganization';

import SentryFunctionEnvironmentVariables from './sentryFunctionsEnvironmentVariables';
import SentryFunctionSubscriptions from './sentryFunctionSubscriptions';

function transformData(data: Record<string, any>) {
  const events: string[] = [];
  if (data.onIssue) {
    events.push('issue');
  }
  if (data.onError) {
    events.push('error');
  }
  if (data.onComment) {
    events.push('comment');
  }
  delete data.onIssue;
  delete data.onError;
  delete data.onComment;
  data.events = events;

  const envVariables: EnvVariable[] = [];
  let i = 0;
  while (data[`env-variable-name-${i}`]) {
    if (data[`env-variable-value-${i}`]) {
      envVariables.push({
        name: data[`env-variable-name-${i}`],
        value: data[`env-variable-value-${i}`],
      });
    }
    delete data[`env-variable-name-${i}`];
    delete data[`env-variable-value-${i}`];
    i++;
  }
  data.envVariables = envVariables;

  const {...output} = data;
  return output;
}

type Props = {
  sentryFunction?: SentryFunction;
} & WrapperProps;

type EnvVariable = {
  name: string;
  value: string;
};
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
  const [form] = useState(() => new FormModel({transformData}));

  const {functionSlug} = props.params;
  const {organization, sentryFunction} = props;
  const method = functionSlug ? 'PUT' : 'POST';
  let endpoint = `/organizations/${organization.slug}/functions/`;
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

  const [events, setEvents] = useState(sentryFunction?.events || []);

  useEffect(() => {
    form.setValue('onIssue', events.includes('issue'));
    form.setValue('onError', events.includes('error'));
    form.setValue('onComment', events.includes('comment'));
  }, [form, events]);

  const [envVariables, setEnvVariables] = useState(
    sentryFunction?.env_variables?.length
      ? sentryFunction?.env_variables
      : [{name: '', value: ''}]
  );

  const handleSubmitError = err => {
    let errorMessage = t('Unknown Error');
    if (err.status >= 400 && err.status < 500) {
      errorMessage = err?.responseJSON.detail ?? errorMessage;
    }
    addErrorMessage(errorMessage);
  };

  const handleSubmitSuccess = data => {
    addSuccessMessage(t('Sentry Function successfully saved.', data.name));
    const baseUrl = `/settings/${organization.slug}/developer-settings/sentry-functions/`;
    const url = `${baseUrl}${data.slug}/`;
    if (sentryFunction) {
      addSuccessMessage(t('%s successfully saved.', data.name));
    } else {
      addSuccessMessage(t('%s successfully created.', data.name));
    }
    browserHistory.push(normalizeUrl(url));
  };

  function handleEditorChange(value, _event) {
    form.setValue('code', value);
  }

  return (
    <div>
      <Feature features="organizations:sentry-functions">
        <h2>
          {sentryFunction ? t('Editing Sentry Function') : t('Create Sentry Function')}
        </h2>
        <Form
          apiMethod={method}
          apiEndpoint={endpoint}
          model={form}
          onPreSubmit={() => {
            addLoadingMessage(t('Saving changes..'));
          }}
          initialData={{
            code: defaultCode,
            events,
            envVariables,
            ...props.sentryFunction,
          }}
          onSubmitError={handleSubmitError}
          onSubmitSuccess={handleSubmitSuccess}
        >
          <JsonForm forms={[{title: t('Sentry Function Details'), fields: formFields}]} />
          <Panel>
            <PanelHeader>{t('Webhooks')}</PanelHeader>
            <PanelBody>
              <SentryFunctionSubscriptions events={events} setEvents={setEvents} />
            </PanelBody>
          </Panel>
          <Panel>
            <SentryFunctionEnvironmentVariables
              envVariables={envVariables}
              setEnvVariables={setEnvVariables}
            />
          </Panel>
          <Panel>
            <PanelHeader>{t('Write your Code Below')}</PanelHeader>
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
      </Feature>
    </div>
  );
}

type WrapperState = {
  sentryFunction?: SentryFunction;
} & DeprecatedAsyncComponent['state'];

type WrapperProps = {
  organization: Organization;
  params: {functionSlug?: string};
} & DeprecatedAsyncComponent['props'];

class SentryFunctionsWrapper extends DeprecatedAsyncComponent<
  WrapperProps,
  WrapperState
> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {functionSlug} = this.props.params;
    const {organization} = this.props;
    if (functionSlug) {
      return [
        [
          'sentryFunction',
          `/organizations/${organization.slug}/functions/${functionSlug}/`,
        ],
      ];
    }
    return [];
  }
  renderBody() {
    return (
      <SentryFunctionDetails sentryFunction={this.state.sentryFunction} {...this.props} />
    );
  }
}

export default withOrganization(SentryFunctionsWrapper);
