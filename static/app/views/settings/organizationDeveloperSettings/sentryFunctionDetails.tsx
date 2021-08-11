import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/addon/lint/lint.js';
import 'codemirror/addon/lint/lint.css';
import 'codemirror/addon/lint/javascript-lint';
import 'codemirror/addon/hint/show-hint.js';
import 'codemirror/addon/hint/show-hint.css';
import 'codemirror/addon/hint/javascript-hint.js';

import * as React from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import CodeMirror from 'codemirror';
import {JSHINT} from 'jshint';
import {Observer} from 'mobx-react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import Button from 'app/components/button';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {IconAdd, IconDelete} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {SentryFunction} from 'app/types';
import {uniqueId} from 'app/utils/guid';
import routeTitleGen from 'app/utils/routeTitle';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';
import InputField from 'app/views/settings/components/forms/inputField';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import FormModel from 'app/views/settings/components/forms/model';
import {Field} from 'app/views/settings/components/forms/type';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

declare global {
  interface Window {
    JSHINT: any;
  }
}
// TODO: set jshint's esversion to 6
window.JSHINT = JSHINT;

// const eventMappings = {
//   issueHook:
// }

const getFormFieldName = (event: string) => {
  return `${event}Hook`;
};

class SentryFunctionFormModel extends FormModel {
  codeMirror: null | CodeMirror.Editor = null;
  // super hacky way of getting envVariables from component state instead of the model
  getEnvVariables: null | (() => EnvVariable[]) = null;

  getTransformedData() {
    const data = super.getTransformedData() as Record<string, any>;
    data.code = this.codeMirror?.getValue();
    // hacky way to get the events
    const events: string[] = [];
    if (data.issueHook) {
      events.push('issue');
    }
    if (data.errorHook) {
      events.push('error');
    }
    if (data.alertHook) {
      events.push('alert');
    }
    delete data.issueHook;
    delete data.errorHook;
    delete data.alertHook;
    data.events = events;

    const {...output} = data;
    for (const key in data) {
      if (key.startsWith('env-variable')) {
        // remove the fields since we aren't going to use them
        delete output[key];
      }
    }
    // now get our envVariables from our function
    output.envVariables = this.getEnvVariables?.();
    return output;
  }
}

type Props = RouteComponentProps<{orgId: string; functionSlug?: string}, {}>;

type EnvVariable = {
  name?: string;
  value?: string;
};

type State = AsyncView['state'] & {
  sentryFunction: SentryFunction | null;
  envVariables: EnvVariable[];
  // rows is an array of strings which are ids of the inputs
  // deleting/inserting does not change the ids of existing envVariables
  rows: string[];
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
    type: 'textarea',
    label: 'Overview',
    autosize: true,
    rows: 1,
    help: 'Description of your Sentry Function and its functionality.',
  },
  {
    name: 'issueHook',
    type: 'boolean',
    label: 'Issue',
    autosize: true,
    help: 'Trigger function on every issue created, resolved, or assigned.',
  },
  {
    name: 'errorHook',
    type: 'boolean',
    label: 'Error',
    autosize: true,
    help: 'Trigger function on every error.',
  },
  {
    name: 'alertHook',
    type: 'boolean',
    label: 'Alert Rule Action',
    autosize: true,
    help: 'If enabled, this integration will be available in Issue Alert rules and Metric Alert rules in Sentry.',
  },
];

const sampleCode = `
const fetch = require('node-fetch');
module.exports = function myScript(event){
  console.log("event is", event);
  fetch('https://example.com/api' {
    method: 'POST',
  });
};
`;

export default class SentryFunctionDetails extends AsyncView<Props, State> {
  form = new SentryFunctionFormModel();
  codeMirror: null | CodeMirror.Editor = null;

  getDefaultState(): State {
    return {
      sentryFunction: null,
      envVariables: [],
      rows: [uniqueId()],
      ...super.getDefaultState(),
    };
  }

  componentDidMount() {
    const {functionSlug} = this.props.params;
    this.form.getEnvVariables = () => this.envVariables;
    if (!functionSlug) {
      this.initCodeEditor(sampleCode);
    }
  }

  initCodeEditor(code: string) {
    const element = document.getElementById('code-editor');
    if (!element) {
      return;
    }
    // lint option not typed correctly but this works lol
    const lint = {
      esversion: 6,
    } as any;
    this.codeMirror = CodeMirror(element, {
      value: code,
      mode: 'javascript',
      lineNumbers: true,
      addModeClass: true,
      gutters: ['CodeMirror-lint-markers'],
      lint,
      extraKeys: {'Ctrl-Space': 'autocomplete'}, // CodeMirror hints
    });
    this.form.codeMirror = this.codeMirror;
  }

  get numEnvRows() {
    return this.state.rows.length;
  }

  get envVariables() {
    return this.state.envVariables;
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {functionSlug, orgId} = this.props.params;
    if (functionSlug) {
      return [['sentryFunction', `/organizations/${orgId}/functions/${functionSlug}/`]];
    }
    return [];
  }

  onLoadAllEndpointsSuccess() {
    const {sentryFunction} = this.state;
    this.initCodeEditor(sentryFunction?.code || sampleCode);
    // mirror state because it's easier for hackweek
    const envVariables = sentryFunction?.envVariables || [];
    const rows = Array.from(Array(envVariables.length + 1).keys()).map(() => uniqueId());
    this.setState({envVariables, rows}, () => {
      rows.forEach((id, pos) => {
        // need to set form inputs because hackweek expediencies
        const {name, value} = envVariables[pos] || {};
        if (name) {
          this.form.setValue(`env-variable-name-${id}`, name);
        }
        if (value) {
          this.form.setValue(`env-variable-value-${id}`, value);
        }
      });
    });

    // also update event form values
    sentryFunction?.events?.forEach(event => {
      this.form.setValue(getFormFieldName(event), true);
    });
  }

  handleSubmitSuccess = (data: SentryFunction) => {
    const {sentryFunction} = this.state;
    const {orgId} = this.props.params;
    if (sentryFunction) {
      addSuccessMessage(t('%s successfully saved.', data.name));
    } else {
      addSuccessMessage(t('%s successfully created.', data.name));
      const url = `/settings/${orgId}/developer-settings/sentry-functions/${data.slug}`;
      browserHistory.push(url);
    }
  };

  handlePreSubmit = () => {
    addLoadingMessage(t('Saving changes\u2026'));
  };

  handleSubmitError = err => {
    let errorMessage = t('Unknown Error');
    if (err.status >= 400 && err.status < 500) {
      errorMessage = err?.responseJSON.detail ?? errorMessage;
    }
    addErrorMessage(errorMessage);
  };

  getTitle() {
    const {orgId} = this.props.params;
    return routeTitleGen(t('Sentry Function Details'), orgId, false);
  }

  handleAddSecret = () => {
    this.setState({
      rows: this.state.rows.concat(uniqueId()),
    });
  };

  handleSecretNameChange(value: string, pos: number) {
    const [...envVariables] = this.envVariables;
    while (envVariables.length <= pos) {
      envVariables.push({});
    }
    envVariables[pos] = {...envVariables[pos], name: value};
    this.setState({envVariables});
  }

  handleSecretValueChange(value: string, pos: number) {
    const [...envVariables] = this.envVariables;
    while (envVariables.length <= pos) {
      envVariables.push({});
    }
    envVariables[pos] = {...envVariables[pos], value};
    this.setState({envVariables});
  }

  removeSecret(pos: number) {
    const [...envVariables] = this.envVariables;
    const [...rows] = this.state.rows;
    envVariables.splice(pos, 1);
    rows.splice(pos, 1);
    this.setState({envVariables, rows});
  }

  renderEnvVariable = (pos: number) => {
    const {envVariables, rows} = this.state;
    const {name, value} = envVariables[pos] || {};
    const id = rows[pos];
    return (
      <OneEnvVar key={id}>
        <InputField
          name={`env-variable-name-${id}`}
          type="text"
          required={false}
          value={name}
          inline={false}
          stacked
          onChange={e => this.handleSecretNameChange(e, pos)}
        />
        <InputField
          name={`env-variable-value-${id}`}
          type="text"
          required={false}
          value={value}
          inline={false}
          stacked
          onChange={e => this.handleSecretValueChange(e, pos)}
        />
        <ButtonHolder>
          <StyledAddButton
            size="small"
            icon={<IconDelete />}
            type="button"
            onClick={() => this.removeSecret(pos)}
          />
        </ButtonHolder>
      </OneEnvVar>
    );
  };

  renderBody() {
    const {functionSlug, orgId} = this.props.params;
    const {sentryFunction} = this.state;

    const method = functionSlug ? 'PUT' : 'POST';
    let endpoint = `/organizations/${orgId}/functions/`;
    if (functionSlug) {
      endpoint += `${functionSlug}/`;
    }

    return (
      <div>
        <SettingsPageHeader title={this.getTitle()} />
        <Form
          apiMethod={method}
          apiEndpoint={endpoint}
          allowUndo
          initialData={{
            organization: orgId,
            ...sentryFunction,
          }}
          model={this.form}
          onPreSubmit={this.handlePreSubmit}
          onSubmitError={this.handleSubmitError}
          onSubmitSuccess={this.handleSubmitSuccess}
        >
          <Observer>
            {() => {
              return (
                <React.Fragment>
                  <JsonForm
                    forms={[{title: 'Sentry Function Details', fields: formFields}]}
                  />
                  <Panel>
                    <PanelHeader>
                      Environment Variables
                      <StyledAddButton
                        size="small"
                        type="button"
                        icon={<IconAdd isCircled />}
                        onClick={this.handleAddSecret}
                      />
                    </PanelHeader>
                    <StyledPanelBody>
                      <OneEnvVar>
                        <EnvHeader>Name</EnvHeader>
                        <EnvHeaderRight>Value</EnvHeaderRight>
                        <EnvHeader />
                      </OneEnvVar>
                      {Array.from(Array(this.numEnvRows).keys()).map(
                        this.renderEnvVariable
                      )}
                    </StyledPanelBody>
                  </Panel>
                  <Panel>
                    <PanelHeader>Write your JS Code Below</PanelHeader>
                    <PanelBody>
                      <div id="code-editor" />
                    </PanelBody>
                  </Panel>
                </React.Fragment>
              );
            }}
          </Observer>
        </Form>
      </div>
    );
  }
}

const OneEnvVar = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1.5fr min-content;
`;

const StyledAddButton = styled(Button)`
  float: right;
`;

const EnvHeader = styled('div')`
  text-align: left;
  margin-top: ${space(2)};
  margin-bottom: ${space(1)};
  color: ${p => p.theme.gray400};
`;

const EnvHeaderRight = styled(EnvHeader)`
  margin-left: -${space(2)};
`;

const ButtonHolder = styled('div')`
  align-items: center;
  display: flex;
  margin-bottom: ${space(2)};
`;

const StyledPanelBody = styled(PanelBody)`
  padding: ${space(2)};
`;
