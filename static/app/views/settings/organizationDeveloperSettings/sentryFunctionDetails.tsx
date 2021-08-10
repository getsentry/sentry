import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import 'codemirror/mode/javascript/javascript';

import * as React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import CodeMirror from 'codemirror';
import {Observer} from 'mobx-react';

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
    delete data.issueHook;
    delete data.errorHook;
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
    help: 'Issue Created, Resolved, or Assigned',
  },
  {
    name: 'errorHook',
    type: 'boolean',
    label: 'Error',
    autosize: true,
    help: 'Error Created',
  },
];

const sampleCode = `
module.exports = function myScript(event){
  console.log("event is", event);
}
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
    const element = document.getElementById('code-editor');
    if (!element) {
      return;
    }
    this.codeMirror = CodeMirror(element, {
      value: sampleCode,
      mode: 'javascript',
      lineNumbers: true,
      addModeClass: true,
    });
    this.form.codeMirror = this.codeMirror;
    this.form.getEnvVariables = () => this.envVariables;
  }

  get numEnvRows() {
    return this.state.rows.length;
  }

  get envVariables() {
    return this.state.envVariables;
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [];
  }

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
    const [...envVariables] = this.state.envVariables;
    while (envVariables.length <= pos) {
      envVariables.push({});
    }
    envVariables[pos] = {...envVariables[pos], name: value};
    this.setState({envVariables});
  }

  handleSecretValueChange(value: string, pos: number) {
    const [...envVariables] = this.state.envVariables;
    while (envVariables.length <= pos) {
      envVariables.push({});
    }
    envVariables[pos] = {...envVariables[pos], value};
    this.setState({envVariables});
  }

  removeSecret(pos: number) {
    const [...envVariables] = this.state.envVariables;
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
      <OneSecret key={id}>
        <InputField
          name={`env-variable-name-${id}`}
          type="text"
          required={false}
          value={name}
          inline={false}
          onChange={e => this.handleSecretNameChange(e, pos)}
        />
        <InputField
          name={`env-variable-value-${id}`}
          type="text"
          required={false}
          value={value}
          inline={false}
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
      </OneSecret>
    );
  };

  renderBody() {
    const {orgId} = this.props.params;

    const method = 'POST';
    const endpoint = `/organizations/${orgId}/functions/`;

    return (
      <div>
        <SettingsPageHeader title={this.getTitle()} />
        <Form
          apiMethod={method}
          apiEndpoint={endpoint}
          allowUndo
          initialData={{
            organization: orgId,
          }}
          model={this.form}
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
                    <PanelBody>
                      <OneSecret>
                        <SecretHeader>Name</SecretHeader>
                        <SecretHeader>Value</SecretHeader>
                      </OneSecret>
                      {Array.from(Array(this.numEnvRows).keys()).map(
                        this.renderEnvVariable
                      )}
                    </PanelBody>
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

const OneSecret = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1.5fr min-content;
`;

const StyledAddButton = styled(Button)`
  float: right;
`;

const SecretHeader = styled('div')`
  text-align: center;
  margin-top: ${space(2)};
  color: ${p => p.theme.gray400};
`;

const ButtonHolder = styled('div')`
  align-items: center;
  display: flex;
  padding-right: ${space(2)};
`;
