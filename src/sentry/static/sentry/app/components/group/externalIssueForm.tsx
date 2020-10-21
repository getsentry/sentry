import PropTypes from 'prop-types';
import * as queryString from 'query-string';
import * as Sentry from '@sentry/react';
import debounce from 'lodash/debounce';

import {addSuccessMessage} from 'app/actionCreators/indicator';
import AsyncComponent from 'app/components/asyncComponent';
import FieldFromConfig from 'app/views/settings/components/forms/fieldFromConfig';
import Form from 'app/views/settings/components/forms/form';
import {FieldValue} from 'app/views/settings/components/forms/model';
import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import {
  Group,
  Integration,
  PlatformExternalIssue,
  IntegrationIssueConfig,
  IssueConfigField,
} from 'app/types';

const MESSAGES_BY_ACTION = {
  link: t('Successfully linked issue.'),
  create: t('Successfully created issue.'),
};

const SUBMIT_LABEL_BY_ACTION = {
  link: t('Link Issue'),
  create: t('Create Issue'),
};

type Props = {
  group: Group;
  integration: Integration;
  action: 'create' | 'link';
  onSubmitSuccess: (externalIssue: PlatformExternalIssue) => void;
} & AsyncComponent['props'];

type State = {
  integrationDetails: IntegrationIssueConfig;
  dynamicFieldValues?: {[key: string]: FieldValue};
} & AsyncComponent['state'];

class ExternalIssueForm extends AsyncComponent<Props, State> {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
    integration: PropTypes.object.isRequired,
    action: PropTypes.oneOf(['link', 'create']),
    onSubmitSuccess: PropTypes.func.isRequired,
  };

  shouldRenderBadRequests = true;
  loadTransasaction?: ReturnType<typeof Sentry.startTransaction>;
  submitTransaction?: ReturnType<typeof Sentry.startTransaction>;

  componentDidMount() {
    this.loadTransasaction = this.startTransaction('load');
  }

  getEndpoints(): [string, string][] {
    const {group, integration, action} = this.props;
    return [
      [
        'integrationDetails',
        `/groups/${group.id}/integrations/${integration.id}/?action=${action}`,
      ],
    ];
  }

  startTransaction = (type: 'load' | 'submit') => {
    const {action, group, integration} = this.props;
    const transaction = Sentry.startTransaction({name: `externalIssueForm.${type}`});
    transaction.setTag('issueAction', action);
    transaction.setTag('groupID', group.id);
    transaction.setTag('projectID', group.project.id);
    transaction.setTag('integrationSlug', integration.provider.slug);
    transaction.setTag('integrationType', 'firstParty');
    return transaction;
  };

  handlePreSubmit = () => {
    this.submitTransaction = this.startTransaction('submit');
  };

  onSubmitSuccess = (data: PlatformExternalIssue) => {
    addSuccessMessage(MESSAGES_BY_ACTION[this.props.action]);
    this.props.onSubmitSuccess(data);
    this.submitTransaction?.finish();
  };

  handleSubmitError = () => {
    this.submitTransaction?.finish();
  };

  onRequestSuccess({stateKey, data}) {
    if (stateKey === 'integrationDetails' && !this.state.dynamicFieldValues) {
      this.setState({
        dynamicFieldValues: this.getDynamicFields(data),
      });
    }
  }

  onLoadAllEndpointsSuccess() {
    this.loadTransasaction?.finish();
  }

  onRequestError = () => {
    this.loadTransasaction?.finish();
  };

  refetchConfig = () => {
    const {dynamicFieldValues} = this.state;
    const {action, group, integration} = this.props;
    const endpoint = `/groups/${group.id}/integrations/${integration.id}/`;
    const query = {action, ...dynamicFieldValues};

    this.api.request(endpoint, {
      method: 'GET',
      query,
      success: (data, _, jqXHR) => {
        this.handleRequestSuccess({stateKey: 'integrationDetails', data, jqXHR}, true);
      },
      error: error => {
        this.handleError(error, ['integrationDetails', endpoint, null, null]);
      },
    });
  };

  getDynamicFields(integrationDetails?: IntegrationIssueConfig) {
    integrationDetails = integrationDetails || this.state.integrationDetails;
    const {action} = this.props;
    const config: IssueConfigField[] = integrationDetails[`${action}IssueConfig`];

    return Object.fromEntries(
      config
        .filter((field: IssueConfigField) => field.updatesForm)
        .map((field: IssueConfigField) => [field.name, field.default])
    );
  }

  onFieldChange = (label: string, value: FieldValue) => {
    const dynamicFields = this.getDynamicFields();
    if (label in dynamicFields) {
      const dynamicFieldValues = this.state.dynamicFieldValues || {};
      dynamicFieldValues[label] = value;

      this.setState(
        {
          dynamicFieldValues,
          reloading: true,
          error: false,
          remainingRequests: 1,
        },
        this.refetchConfig
      );
    }
  };

  getOptions = (field: IssueConfigField, input: string) =>
    new Promise((resolve, reject) => {
      if (!input) {
        const choices =
          (field.choices as Array<[number | string, number | string]>) || [];
        const options = choices.map(([value, label]) => ({value, label}));
        return resolve({options});
      }
      return this.debouncedOptionLoad(field, input, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });

  debouncedOptionLoad = debounce(
    async (
      field: IssueConfigField,
      input: string,
      cb: (err: Error | null, result?) => void
    ) => {
      const query = queryString.stringify({
        ...this.state.dynamicFieldValues,
        field: field.name,
        query: input,
      });

      const url = field.url || '';
      const separator = url.includes('?') ? '&' : '?';
      // We can't use the API client here since the URL is not scoped under the
      // API endpoints (which the client prefixes)
      try {
        const response = await fetch(url + separator + query);
        cb(null, {options: response.ok ? await response.json() : []});
      } catch (err) {
        cb(err);
      }
    },
    200,
    {trailing: true}
  );

  getFieldProps = (field: IssueConfigField) =>
    field.url
      ? {
          loadOptions: (input: string) => this.getOptions(field, input),
          async: true,
          cache: false,
          onSelectResetsInput: false,
          onCloseResetsInput: false,
          onBlurResetsInput: false,
          autoload: true,
        }
      : {};

  renderBody() {
    const {integrationDetails} = this.state;
    const {action, group, integration} = this.props;
    const config: IssueConfigField[] = integrationDetails[`${action}IssueConfig`];

    const initialData = {};
    config.forEach(field => {
      // passing an empty array breaks multi select
      // TODO(jess): figure out why this is breaking and fix
      initialData[field.name] = field.multiple ? '' : field.default;
    });

    return (
      <Form
        apiEndpoint={`/groups/${group.id}/integrations/${integration.id}/`}
        apiMethod={action === 'create' ? 'POST' : 'PUT'}
        onSubmitSuccess={this.onSubmitSuccess}
        initialData={initialData}
        onFieldChange={this.onFieldChange}
        submitLabel={SUBMIT_LABEL_BY_ACTION[action]}
        submitDisabled={this.state.reloading}
        footerClass="modal-footer"
        onPreSubmit={this.handlePreSubmit}
        onSubmitError={this.handleSubmitError}
      >
        {config.map(field => (
          <FieldFromConfig
            key={`${field.name}-${field.default}`}
            field={field}
            inline={false}
            stacked
            flexibleControlStateSize
            disabled={this.state.reloading}
            {...this.getFieldProps(field)}
          />
        ))}
      </Form>
    );
  }
}

export default ExternalIssueForm;
