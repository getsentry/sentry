import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';

import * as React from 'react';
import {RouteComponentProps} from 'react-router';
import CodeMirror from 'codemirror';
import {Observer} from 'mobx-react';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import {SentryFunction} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import FormModel from 'app/views/settings/components/forms/model';
import {Field} from 'app/views/settings/components/forms/type';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

class SentryFunctionFormModel extends FormModel {
  codeMirror: null | CodeMirror = null;
  getTransformedData() {
    const data = super.getTransformedData() as Record<string, any>;
    data.code = this.codeMirror?.getValue();
    return data;
  }
}

type Props = RouteComponentProps<{orgId: string; functionSlug?: string}, {}>;

type State = AsyncView['state'] & {
  sentryFunction: SentryFunction | null;
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

export default class SentryApplicationDetails extends AsyncView<Props, State> {
  form = new SentryFunctionFormModel();
  codeMirror: null | CodeMirror = null;

  getDefaultState(): State {
    return {
      sentryFunction: null,
      ...super.getDefaultState(),
    };
  }

  componentDidMount() {
    const element = document.getElementById('code-editor');
    this.codeMirror = CodeMirror(element, {
      value: 'function myScript(){return 100;}\n',
      lineNumbers: true,
      mode: 'javascript',
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

  // Events may come from the API as "issue.created" when we just want "issue" here.
  normalize(events) {
    if (events.length === 0) {
      return events;
    }

    return events.map(e => e.split('.').shift());
  }

  renderBody() {
    const {orgId} = this.props.params;

    const method = 'POST';
    const endpoint = `/sentry-functions/`;

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
