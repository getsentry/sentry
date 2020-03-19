import React from 'react';
import PropTypes from 'prop-types';
import debounce from 'lodash/debounce';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {addQueryParamsToExistingUrl} from 'app/utils/queryString';
import FieldFromConfig from 'app/views/settings/components/forms/fieldFromConfig';
import Form from 'app/views/settings/components/forms/form';
import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import ExternalIssueStore from 'app/stores/externalIssueStore';
import getStacktraceBody from 'app/utils/getStacktraceBody';
import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import {Group, PlatformExternalIssue, Event, SentryAppInstallation} from 'app/types';
import {Field, FieldValue} from 'app/views/settings/components/forms/type';
import FormModel from 'app/views/settings/components/forms/model';

//0 is a valid choice but empty string, undefined, and null are not
const hasValue = value => !!value || value === 0;

type FieldFromSchema = Field & {
  default?: string;
  uri?: string;
  depends?: string[];
};

type Config = {
  uri: string;
  required_fields?: FieldFromSchema[];
  optional_fields?: FieldFromSchema[];
};

//only need required_fields and optional_fields
type State = Omit<Config, 'uri'>;

type Props = {
  api: Client;
  group: Group;
  sentryAppInstallation: SentryAppInstallation;
  appName: string;
  config: Config;
  action: 'create' | 'link';
  event: Event;
  onSubmitSuccess: (externalIssue: PlatformExternalIssue) => void;
};

export class SentryAppExternalIssueForm extends React.Component<Props, State> {
  static propTypes: any = {
    api: PropTypes.object.isRequired,
    group: SentryTypes.Group.isRequired,
    sentryAppInstallation: PropTypes.object,
    appName: PropTypes.string,
    config: PropTypes.object.isRequired,
    action: PropTypes.oneOf(['link', 'create']),
    event: SentryTypes.Event,
    onSubmitSuccess: PropTypes.func,
  };
  state: State = {};

  componentDidMount() {
    this.resetStateFromProps();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.action !== this.props.action) {
      this.resetStateFromProps();
    }
  }

  model = new FormModel();

  resetStateFromProps() {
    const {config} = this.props;
    this.setState({
      required_fields: config.required_fields,
      optional_fields: config.optional_fields,
    });
  }

  onSubmitSuccess = (issue: PlatformExternalIssue) => {
    ExternalIssueStore.add(issue);
    this.props.onSubmitSuccess(issue);
  };

  onSubmitError = () => {
    const {action, appName} = this.props;
    addErrorMessage(t('Unable to %s %s issue.', action, appName));
  };

  getOptions = (field: Field, input: string) =>
    new Promise(resolve => {
      this.debouncedOptionLoad(field, input, resolve);
    });

  debouncedOptionLoad = debounce(
    // debounce is used to prevent making a request for every input change and
    // instead makes the requests every 200ms
    async (field: FieldFromSchema, input, resolve) => {
      const choices = await this.makeExternalRequest(field, input);
      const options = choices.map(([value, label]) => ({value, label}));
      return resolve({options});
    },
    200,
    {trailing: true}
  );

  makeExternalRequest = async (field: FieldFromSchema, input: FieldValue) => {
    const install = this.props.sentryAppInstallation;
    const projectId = this.props.group.project.id;
    const query: {[key: string]: any} = {
      projectId,
      uri: field.uri,
      query: input,
    };

    if (field.depends?.length) {
      const dependentData = field.depends.reduce((accum, dependentField: string) => {
        accum[dependentField] = this.model.fields.get(dependentField);
        return accum;
      }, {});
      //stringify the data
      query.dependentData = JSON.stringify(dependentData);
    }

    const {choices} = await this.props.api.requestPromise(
      `/sentry-app-installations/${install.uuid}/external-requests/`,
      {
        query,
      }
    );
    return choices || [];
  };

  fieldProps = (field: FieldFromSchema) =>
    field.uri
      ? {
          loadOptions: (input: string) => this.getOptions(field, input),
          async: true,
          cache: false,
          onSelectResetsInput: false,
          onCloseResetsInput: false,
          onBlurResetsInput: false,
          autoload: false,
        }
      : {};

  getStacktrace() {
    const evt = this.props.event;
    const contentArr = getStacktraceBody(evt);

    if (contentArr && contentArr.length > 0) {
      return '\n\n```\n' + contentArr[0] + '\n```';
    } else {
      return '';
    }
  }

  getFieldDefault(field: FieldFromSchema) {
    const {group, appName} = this.props;
    if (field.type === 'textarea') {
      field.maxRows = 10;
      field.autosize = true;
    }
    switch (field.default) {
      case 'issue.title':
        return group.title;
      case 'issue.description':
        const stacktrace = this.getStacktrace();
        const queryParams = {referrer: appName};
        const url = addQueryParamsToExistingUrl(group.permalink, queryParams);
        const shortId = group.shortId;
        return t('Sentry Issue: [%s](%s)%s', shortId, url, stacktrace);
      default:
        return '';
    }
  }

  handleFieldChange = async (id: string, _value: FieldValue) => {
    const config = this.state;

    let requiredFields = config.required_fields || [];
    let optionalFields = config.optional_fields || [];

    const fieldList: FieldFromSchema[] = requiredFields.concat(optionalFields);

    //could have multiple impacted fields
    const impactedFields = fieldList.filter(({depends}) => {
      if (!depends?.length) {
        return false;
      }
      // must be dependent on the field we just set
      return depends.includes(id);
    });

    //reset all impacted fields first
    impactedFields.forEach(impactedField =>
      this.model.fields.delete(impactedField.name || '')
    );

    //iterate through all the impacted fields and get new values
    for (const impactedField of impactedFields) {
      const choices = await this.makeExternalRequest(impactedField, '');
      const requiredIndex = requiredFields.indexOf(impactedField);
      const optionalIndex = optionalFields.indexOf(impactedField);

      const updatedField = {...impactedField, choices};

      //immutably updat the lists with the updated field depending where we got it from
      if (requiredIndex > -1) {
        requiredFields = [
          ...requiredFields.slice(0, requiredIndex),
          updatedField,
          ...requiredFields.slice(requiredIndex + 1),
        ];
      } else if (optionalIndex > -1) {
        optionalFields = [
          ...optionalFields.slice(0, optionalIndex),
          updatedField,
          ...optionalFields.slice(optionalIndex + 1),
        ];
      }
    }

    //set state once at the end to avoid things loading at different times
    this.setState({
      required_fields: requiredFields,
      optional_fields: optionalFields,
    });
  };

  renderField = (field: FieldFromSchema) => {
    if (['text', 'textarea'].includes(field.type) && field.default) {
      field = {...field, defaultValue: this.getFieldDefault(field)};
    }

    if (field.depends?.length) {
      //check if this is dependent on other fields which haven't been set yet
      const shouldDisable = field.depends.some(
        dependentField => !hasValue(this.model.fields.get(dependentField))
      );
      if (shouldDisable) {
        field = {...field, disabled: true};
      }
    }

    return (
      <FieldFromConfig key={`${field.name}`} field={field} {...this.fieldProps(field)} />
    );
  };

  render() {
    const {sentryAppInstallation, action} = this.props;

    const requiredFields = this.state.required_fields || [];
    const optionalFields = this.state.optional_fields || [];
    const metaFields: Field[] = [
      {
        type: 'hidden',
        name: 'action',
        defaultValue: action,
      },
      {
        type: 'hidden',
        name: 'groupId',
        defaultValue: this.props.group.id,
      },
      {
        type: 'hidden',
        name: 'uri',
        defaultValue: this.props.config.uri,
      },
    ];

    if (!sentryAppInstallation) {
      return '';
    }

    return (
      <Form
        key={action}
        apiEndpoint={`/sentry-app-installations/${sentryAppInstallation.uuid}/external-issues/`}
        apiMethod="POST"
        onSubmitSuccess={this.onSubmitSuccess}
        onSubmitError={this.onSubmitError}
        onFieldChange={this.handleFieldChange}
        model={this.model}
      >
        {metaFields.map(this.renderField)}

        {requiredFields.map((field: FieldFromSchema) => {
          field = Object.assign({}, field, {
            choices: field.choices || [],
            inline: false,
            stacked: true,
            flexibleControlStateSize: true,
            required: true,
          });

          return this.renderField(field);
        })}

        {optionalFields.map((field: FieldFromSchema) => {
          field = Object.assign({}, field, {
            choices: field.choices || [],
            inline: false,
            stacked: true,
            flexibleControlStateSize: true,
          });

          return this.renderField(field);
        })}
      </Form>
    );
  }
}

export default withApi(SentryAppExternalIssueForm);
