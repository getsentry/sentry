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

    // now get our secrets
    const secrets: Secret[] = [];
    const {...output} = data;
    for (const key in data) {
      const value = data[key];
      if (key.startsWith('secret-name-')) {
        const pos = Number(key.replace('secret-name-', ''));
        while (secrets.length <= pos) {
          secrets.push({});
        }
        secrets[pos].name = value;
        delete output[key];
      }
      if (key.startsWith('secret-value-')) {
        const pos = Number(key.replace('secret-value-', ''));
        while (secrets.length <= pos) {
          secrets.push({});
        }
        secrets[pos].value = value;
        delete output[key];
      }
    }
    // TODO validate and/or filter
    output.secrets = secrets;
    return output;
  }
}

type Props = RouteComponentProps<{orgId: string; functionSlug?: string}, {}>;

type Secret = {
  name?: string;
  value?: string;
};

type State = AsyncView['state'] & {
  sentryFunction: SentryFunction | null;
  secrets: Secret[];
  numSecretRows: number;
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

export default class SentryFunctionDetails extends AsyncView<Props, State> {
  form = new SentryFunctionFormModel();
  codeMirror: null | CodeMirror.Editor = null;

  getDefaultState(): State {
    return {
      sentryFunction: null,
      secrets: [],
      numSecretRows: 1,
      ...super.getDefaultState(),
    };
  }

  componentDidMount() {
    const element = document.getElementById('code-editor');
    if (!element) {
      return;
    }
    this.codeMirror = CodeMirror(element, {
      value: 'function myScript(){\n  return 100;\n}\n',
      mode: 'javascript',
      lineNumbers: true,
      addModeClass: true,
    });
    this.form.codeMirror = this.codeMirror;
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [];
  }

  getTitle() {
    const {orgId} = this.props.params;
    return routeTitleGen(t('Sentry Function Details'), orgId, false);
  }

  handleAddSecret = () => {
    this.setState({numSecretRows: this.state.numSecretRows + 1});
  };

  handleSecretNameChange(value: string, pos: number) {
    const [...secrets] = this.state.secrets;
    while (secrets.length <= pos) {
      secrets.push({});
    }
    secrets[pos] = {...secrets[pos], name: value};
    this.setState({secrets});
  }

  handleSecretValueChange(value: string, pos: number) {
    const [...secrets] = this.state.secrets;
    while (secrets.length <= pos) {
      secrets.push({});
    }
    secrets[pos] = {...secrets[pos], value};
    this.setState({secrets});
  }

  renderSecret = (pos: number) => {
    const {secrets} = this.state;
    const {name, value} = secrets[pos] || {};
    return (
      <OneSecret key={pos}>
        <InputField
          name={`secret-name-${pos}`}
          type="text"
          value={name}
          inline={false}
          required={false}
          onChange={e => this.handleSecretNameChange(e, pos)}
        />
        <InputField
          name={`secret-value-${pos}`}
          type="password"
          value={value}
          inline={false}
          required={false}
          onChange={e => this.handleSecretValueChange(e, pos)}
        />
      </OneSecret>
    );
  };

  renderBody() {
    const {orgId} = this.props.params;
    const {numSecretRows} = this.state;

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
                      Secrets
                      <StyledAddButton
                        size="small"
                        icon={<IconAdd isCircled />}
                        onClick={this.handleAddSecret}
                      />
                    </PanelHeader>
                    <PanelBody>
                      <OneSecret>
                        <SecretHeader>Name</SecretHeader>
                        <SecretHeader>Value</SecretHeader>
                      </OneSecret>
                      {Array.from(Array(numSecretRows).keys()).map(this.renderSecret)}
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
  grid-template-columns: 1fr 1.5fr;
`;

const StyledAddButton = styled(Button)`
  float: right;
`;

const SecretHeader = styled('div')`
  text-align: center;
  margin-top: ${space(2)};
  color: ${p => p.theme.gray400};
`;
