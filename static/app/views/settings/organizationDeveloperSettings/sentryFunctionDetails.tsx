import * as React from 'react';
import {RouteComponentProps} from 'react-router';
import {Observer} from 'mobx-react';

import {t} from 'app/locale';
import {SentryFunction} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import FormModel from 'app/views/settings/components/forms/model';
import {Field} from 'app/views/settings/components/forms/type';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

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
  form = new FormModel();

  getDefaultState(): State {
    return {
      sentryFunction: null,
      ...super.getDefaultState(),
    };
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
                </React.Fragment>
              );
            }}
          </Observer>
        </Form>
      </div>
    );
  }
}
