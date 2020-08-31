import React from 'react';
import PropTypes from 'prop-types';
import debounce from 'lodash/debounce';
import {createFilter} from 'react-select';

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
import {replaceAtArrayIndex} from 'app/utils/replaceAtArrayIndex';

//0 is a valid choice but empty string, undefined, and null are not
const hasValue = value => !!value || value === 0;

type FieldFromSchema = Omit<Field, 'choices' | 'type'> & {
  type: 'select' | 'textarea' | 'text';
  default?: string;
  uri?: string;
  depends_on?: string[];
  choices?: Array<[any, string]>;
  async?: boolean;
};

type Config = {
  uri: string;
  required_fields?: FieldFromSchema[];
  optional_fields?: FieldFromSchema[];
};

//only need required_fields and optional_fields
type State = Omit<Config, 'uri'> & {
  optionsByField: Map<string, Array<{label: string; value: any}>>;
};

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
  state: State = {optionsByField: new Map()};

  componentDidMount() {
    this.resetStateFromProps();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.action !== this.props.action) {
      this.model.reset();
      this.resetStateFromProps();
    }
  }

  model = new FormModel();

  //reset the state when we mount or the action changes
  resetStateFromProps() {
    const {config, action, group} = this.props;
    this.setState({
      required_fields: config.required_fields,
      optional_fields: config.optional_fields,
    });
    //we need to pass these fields in the API so just set them as values so we don't need hidden form fields
    this.model.setInitialData({
      action,
      groupId: group.id,
      uri: config.uri,
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

  getOptions = (field: FieldFromSchema, input: string) =>
    new Promise(resolve => {
      this.debouncedOptionLoad(field, input, resolve);
    });

  debouncedOptionLoad = debounce(
    // debounce is used to prevent making a request for every input change and
    // instead makes the requests every 200ms
    async (field: FieldFromSchema, input, resolve) => {
      const choices = await this.makeExternalRequest(field, input);
      const options = choices.map(([value, label]) => ({value, label}));
      const optionsByField = new Map(this.state.optionsByField);
      optionsByField.set(field.name, options);
      this.setState({
        optionsByField,
      });
      return resolve(options);
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

    if (field.depends_on) {
      const dependentData = field.depends_on.reduce((accum, dependentField: string) => {
        accum[dependentField] = this.model.getValue(dependentField);
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

  /**
   * This function determines which fields need to be reset and new options fetched
   * based on the dependencies defined with the depends_on attribute.
   * This is done because the autoload flag causes fields to load at different times
   * if you have multiple dependent fields while this solution updates state at once.
   */
  handleFieldChange = async (id: string) => {
    const config = this.state;

    let requiredFields = config.required_fields || [];
    let optionalFields = config.optional_fields || [];

    const fieldList: FieldFromSchema[] = requiredFields.concat(optionalFields);

    //could have multiple impacted fields
    const impactedFields = fieldList.filter(({depends_on}) => {
      if (!depends_on) {
        return false;
      }
      // must be dependent on the field we just set
      return depends_on.includes(id);
    });

    //load all options in parallel
    const choiceArray = await Promise.all(
      impactedFields.map(field => {
        //reset all impacted fields first
        this.model.setValue(field.name || '', '', {quiet: true});
        return this.makeExternalRequest(field, '');
      })
    );

    this.setState(state => {
      //pull the field lists from latest state
      requiredFields = state.required_fields || [];
      optionalFields = state.optional_fields || [];
      //iterate through all the impacted fields and get new values
      impactedFields.forEach((impactedField, i) => {
        const choices = choiceArray[i];
        const requiredIndex = requiredFields.indexOf(impactedField);
        const optionalIndex = optionalFields.indexOf(impactedField);

        const updatedField = {...impactedField, choices};

        //immutably update the lists with the updated field depending where we got it from
        if (requiredIndex > -1) {
          requiredFields = replaceAtArrayIndex(
            requiredFields,
            requiredIndex,
            updatedField
          );
        } else if (optionalIndex > -1) {
          optionalFields = replaceAtArrayIndex(
            optionalFields,
            optionalIndex,
            updatedField
          );
        }
      });
      return {
        required_fields: requiredFields,
        optional_fields: optionalFields,
      };
    });
  };

  renderField = (field: FieldFromSchema, required: boolean) => {
    //This function converts the field we get from the backend into
    //the field we need to pass down
    let fieldToPass: Field = {
      ...field,
      inline: false,
      stacked: true,
      flexibleControlStateSize: true,
      required,
    };

    //async only used for select components
    const isAsync = typeof field.async === 'undefined' ? true : !!field.async; //default to true

    if (fieldToPass.type === 'select') {
      // find the options from state to pass down
      const defaultOptions = (field.choices || []).map(([value, label]) => ({
        value,
        label,
      }));
      const options = this.state.optionsByField.get(field.name) || defaultOptions;
      //filter by what the user is typing
      const filterOption = createFilter({});
      fieldToPass = {
        ...fieldToPass,
        options,
        defaultOptions,
        filterOption,
      };
      //default message for async select fields
      if (isAsync) {
        fieldToPass.noOptionsMessage = () => 'Type to search';
      }
    } else if (['text', 'textarea'].includes(fieldToPass.type || '') && field.default) {
      fieldToPass = {...fieldToPass, defaultValue: this.getFieldDefault(field)};
    }

    if (field.depends_on) {
      //check if this is dependent on other fields which haven't been set yet
      const shouldDisable = field.depends_on.some(
        dependentField => !hasValue(this.model.getValue(dependentField))
      );
      if (shouldDisable) {
        fieldToPass = {...fieldToPass, disabled: true};
      }
    }

    //if we have a uri, we need to set extra parameters
    const extraProps = field.uri
      ? {
          loadOptions: (input: string) => this.getOptions(field, input),
          async: isAsync,
          cache: false,
          onSelectResetsInput: false,
          onCloseResetsInput: false,
          onBlurResetsInput: false,
          autoload: false,
        }
      : {};

    return (
      <FieldFromConfig
        deprecatedSelectControl={false}
        key={field.name}
        field={fieldToPass}
        data-test-id={field.name}
        {...extraProps}
      />
    );
  };

  render() {
    const {sentryAppInstallation, action} = this.props;

    const requiredFields = this.state.required_fields || [];
    const optionalFields = this.state.optional_fields || [];

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
        {requiredFields.map((field: FieldFromSchema) => {
          return this.renderField(field, true);
        })}

        {optionalFields.map((field: FieldFromSchema) => {
          return this.renderField(field, false);
        })}
      </Form>
    );
  }
}

export default withApi(SentryAppExternalIssueForm);
