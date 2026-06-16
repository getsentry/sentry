import {Component, Fragment} from 'react';
import isFunction from 'lodash/isFunction';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {Form} from 'sentry/components/deprecatedforms/form';
import {GenericField} from 'sentry/components/deprecatedforms/genericField';
import {FormState} from 'sentry/components/forms/state';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {GroupStore} from 'sentry/stores/groupStore';
import type {Group} from 'sentry/types/group';
import type {Plugin} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';

const callbackWithArgs = function (context: any, callback: any, ...args: any) {
  return isFunction(callback) ? callback.bind(context, ...args) : undefined;
};

type GenericFieldProps = Parameters<typeof GenericField>[0];

type Field = {
  depends?: string[];
  has_autocomplete?: boolean;
} & Omit<GenericFieldProps, 'formState'>['config'];

type ActionType = 'link' | 'create' | 'unlink';
type FieldStateValue = (typeof FormState)[keyof typeof FormState];

type Props = {
  actionType: ActionType;
  group: Group;
  organization: Organization;
  plugin: Plugin & {
    issue?: {
      issue_id: string;
      label: string;
      url: string;
    };
  };
  project: Project;
  onError?: (data: any) => void;
  onSuccess?: (data: any) => void;
};

type State = {
  createFormData: Record<string, any>;
  dependentFieldState: Record<string, FieldStateValue>;
  linkFormData: Record<string, any>;
  state: FormState;
  unlinkFormData: Record<string, any>;
  createFieldList?: Field[];
  error?: {
    message: string;
    auth_url?: string;
    error_type?: string;
    errors?: Record<string, string>;
    has_auth_configured?: boolean;
    required_auth_settings?: string[];
  };
  linkFieldList?: Field[];
  loading?: boolean;
  unlinkFieldList?: Field[];
};

export class IssueActions extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    [
      'onLoadSuccess',
      'onLoadError',
      'onSave',
      'onSaveSuccess',
      'onSaveError',
      'onSaveComplete',
      'renderField',
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    ].map(method => (this[method] = this[method].bind(this)));

    if (this.fetchData) {
      this.fetchData = this.onLoad.bind(this, this.fetchData.bind(this));
    }

    this.createIssue = this.onSave.bind(this, this.createIssue.bind(this));
    this.linkIssue = this.onSave.bind(this, this.linkIssue.bind(this));
    this.unlinkIssue = this.onSave.bind(this, this.unlinkIssue.bind(this));
    this.onSuccess = this.onSaveSuccess.bind(this, this.onSuccess.bind(this));
    this.errorHandler = this.onLoadError.bind(this, this.errorHandler.bind(this));

    this.state = {
      state: ['link', 'create'].includes(this.props.actionType)
        ? FormState.LOADING
        : FormState.READY,
      loading: ['link', 'create'].includes(this.props.actionType),
      createFormData: {},
      linkFormData: {},
      unlinkFormData: {},
      dependentFieldState: {},
    } as Readonly<State>;
  }

  componentDidMount() {
    const plugin = this.props.plugin;
    if (!plugin.issue && this.props.actionType !== 'unlink') {
      this.fetchData();
    }
  }

  componentWillUnmount() {
    this.api.clear();
    window.clearTimeout(this.successMessageTimeout);
    window.clearTimeout(this.errorMessageTimeout);
  }

  successMessageTimeout: number | undefined = undefined;
  errorMessageTimeout: number | undefined = undefined;

  api = new Client();

  getGroup() {
    return this.props.group;
  }

  getProject() {
    return this.props.project;
  }

  getOrganization() {
    return this.props.organization;
  }

  getFieldListKey() {
    switch (this.props.actionType) {
      case 'link':
        return 'linkFieldList';
      case 'unlink':
        return 'unlinkFieldList';
      case 'create':
        return 'createFieldList';
      default:
        throw new Error('Unexpeced action type');
    }
  }

  getFormDataKey(actionType?: ActionType) {
    switch (actionType || this.props.actionType) {
      case 'link':
        return 'linkFormData';
      case 'unlink':
        return 'unlinkFormData';
      case 'create':
        return 'createFormData';
      default:
        throw new Error('Unexpeced action type');
    }
  }

  getFormData() {
    const key = this.getFormDataKey();
    return this.state[key] || {};
  }

  getFieldList() {
    const key = this.getFieldListKey();
    return this.state[key] || [];
  }

  getPluginCreateEndpoint() {
    return `/organizations/${this.getOrganization().slug}/issues/${this.getGroup().id}/plugins/${this.props.plugin.slug}/create/`;
  }

  getPluginLinkEndpoint() {
    return `/organizations/${this.getOrganization().slug}/issues/${this.getGroup().id}/plugins/${this.props.plugin.slug}/link/`;
  }

  getPluginUnlinkEndpoint() {
    return `/organizations/${this.getOrganization().slug}/issues/${this.getGroup().id}/plugins/${this.props.plugin.slug}/unlink/`;
  }

  setDependentFieldState(fieldName: any, state: any) {
    const dependentFieldState = {...this.state.dependentFieldState, [fieldName]: state};
    this.setState({dependentFieldState});
  }

  loadOptionsForDependentField = async (field: any) => {
    const formData = this.getFormData();

    const groupId = this.getGroup().id;
    const pluginSlug = this.props.plugin.slug;
    const url = `/organizations/${this.getOrganization().slug}/issues/${groupId}/plugins/${pluginSlug}/options/`;

    const dependentFormValues = Object.fromEntries(
      field.depends.map((fieldKey: any) => [fieldKey, formData[fieldKey]])
    );
    const query = {
      option_field: field.name,
      ...dependentFormValues,
    };
    try {
      this.setDependentFieldState(field.name, FormState.LOADING);
      const result = await this.api.requestPromise(url, {query});
      this.updateOptionsOfDependentField(field, result[field.name]);
      this.setDependentFieldState(field.name, FormState.READY);
    } catch (err) {
      this.setDependentFieldState(field.name, FormState.ERROR);
      this.errorHandler(err);
    }
  };

  updateOptionsOfDependentField = (field: Field, choices: Field['choices']) => {
    const formListKey = this.getFieldListKey();
    let fieldList = this.state[formListKey];
    if (!fieldList) {
      return;
    }

    const indexOfField = fieldList.findIndex(({name}) => name === field.name);
    field = {...field, choices};

    fieldList = fieldList.slice();
    fieldList[indexOfField] = field;

    this.setState(prevState => ({...prevState, [formListKey]: fieldList}));
  };

  resetOptionsOfDependentField = (field: Field) => {
    this.updateOptionsOfDependentField(field, []);
    const formDataKey = this.getFormDataKey();
    const formData = {...this.state[formDataKey]};
    formData[field.name] = '';
    this.setState(prevState => ({...prevState, [formDataKey]: formData}));
    this.setDependentFieldState(field.name, FormState.DISABLED);
  };

  getInputProps(field: Field) {
    const props: {isLoading?: boolean; readonly?: boolean} = {};

    if (field.depends && field.depends.length > 0) {
      switch (this.state.dependentFieldState[field.name]) {
        case FormState.LOADING:
          props.isLoading = true;
          props.readonly = true;
          break;
        case FormState.DISABLED:
        case FormState.ERROR:
          props.readonly = true;
          break;
        default:
          break;
      }
    }

    return props;
  }

  setError(error: any, defaultMessage: string) {
    let errorBody: any;
    if (error.status === 400 && error.responseJSON) {
      errorBody = error.responseJSON;
    } else {
      errorBody = {message: defaultMessage};
    }
    this.setState({error: errorBody});
  }

  errorHandler(error: any) {
    const state: Pick<State, 'loading' | 'error'> = {
      loading: false,
    };
    if (error.status === 400 && error.responseJSON) {
      state.error = error.responseJSON;
    } else {
      state.error = {message: t('An unknown error occurred.')};
    }
    this.setState(state);
  }

  onLoad(callback: any, ...args: any[]) {
    this.setState(
      {
        state: FormState.LOADING,
      },
      callbackWithArgs(this, callback, ...args)
    );
  }

  onLoadSuccess() {
    this.setState({
      state: FormState.READY,
    });

    const fieldList = this.getFieldList();
    fieldList.forEach(field => {
      if (field.depends && field.depends.length > 0) {
        this.setDependentFieldState(field.name, FormState.DISABLED);
      }
    });
  }

  onLoadError(callback: any, ...args: any[]) {
    this.setState(
      {
        state: FormState.ERROR,
      },
      callbackWithArgs(this, callback, ...args)
    );
    addErrorMessage(t('An error occurred.'));
  }

  onSave(callback: any, ...args: any[]) {
    if (this.state.state === FormState.SAVING) {
      return;
    }
    callback = callbackWithArgs(this, callback, ...args);
    this.setState(
      {
        state: FormState.SAVING,
      },
      () => {
        addLoadingMessage(t('Saving changes…'));
        callback?.();
      }
    );
  }

  onSaveSuccess(callback: any, ...args: any[]) {
    callback = callbackWithArgs(this, callback, ...args);
    this.setState(
      {
        state: FormState.READY,
      },
      () => callback?.()
    );

    window.clearTimeout(this.successMessageTimeout);
    this.successMessageTimeout = window.setTimeout(() => {
      addSuccessMessage(t('Success!'));
    }, 0);
  }

  onSaveError(callback: any, ...args: any[]) {
    callback = callbackWithArgs(this, callback, ...args);
    this.setState(
      {
        state: FormState.ERROR,
      },
      () => callback?.()
    );

    window.clearTimeout(this.errorMessageTimeout);
    this.errorMessageTimeout = window.setTimeout(() => {
      addErrorMessage(t('Unable to save changes. Please try again.'));
    }, 0);
  }

  onSaveComplete(callback: any, ...args: any[]) {
    clearIndicators();
    callback = callbackWithArgs(this, callback, ...args);
    callback?.();
  }

  async fetchData() {
    if (this.props.actionType === 'create') {
      try {
        const [data] = await this.api.requestPromise(this.getPluginCreateEndpoint(), {
          includeAllArgs: true,
        });
        const createFormData = {};
        data.forEach((field: any) => {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          createFormData[field.name] = field.default;
        });
        this.setState(
          {
            createFieldList: data,
            error: undefined,
            loading: false,
            createFormData,
          },
          this.onLoadSuccess
        );
      } catch (error) {
        this.errorHandler(error);
      }
    } else if (this.props.actionType === 'link') {
      try {
        const [data] = await this.api.requestPromise(this.getPluginLinkEndpoint(), {
          includeAllArgs: true,
        });
        const linkFormData = {};
        data.forEach((field: any) => {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          linkFormData[field.name] = field.default;
        });
        this.setState(
          {
            linkFieldList: data,
            error: undefined,
            loading: false,
            linkFormData,
          },
          this.onLoadSuccess
        );
      } catch (error) {
        this.errorHandler(error);
      }
    }
  }

  onSuccess(data: any) {
    // TODO(ts): This needs a better approach. We splice in this attribute to trigger
    // a refetch in GroupDetails
    type StaleGroup = Group & {stale?: boolean};

    trackAnalytics('issue_details.external_issue_created', {
      organization: this.props.organization,
      ...getAnalyticsDataForGroup(this.props.group),
      external_issue_provider: this.props.plugin.slug,
      external_issue_type: 'plugin',
    });

    GroupStore.onUpdateSuccess('', [this.getGroup().id], {stale: true} as StaleGroup);
    this.props.onSuccess?.(data);
  }

  async createIssue() {
    try {
      const [data] = await this.api.requestPromise(this.getPluginCreateEndpoint(), {
        data: this.state.createFormData,
        includeAllArgs: true,
      });
      this.onSuccess(data);
    } catch (error) {
      this.onSaveError((err: any) => {
        this.setError(err, t('There was an error creating the issue.'));
      }, error);
    } finally {
      this.onSaveComplete(null);
    }
  }

  async linkIssue() {
    try {
      const [data] = await this.api.requestPromise(this.getPluginLinkEndpoint(), {
        data: this.state.linkFormData,
        includeAllArgs: true,
      });
      this.onSuccess(data);
    } catch (error) {
      this.onSaveError((err: any) => {
        this.setError(err, t('There was an error linking the issue.'));
      }, error);
    } finally {
      this.onSaveComplete(null);
    }
  }

  async unlinkIssue() {
    try {
      const [data] = await this.api.requestPromise(this.getPluginUnlinkEndpoint(), {
        includeAllArgs: true,
      });
      this.onSuccess(data);
    } catch (error) {
      this.onSaveError((err: any) => {
        this.setError(err, t('There was an error unlinking the issue.'));
      }, error);
    } finally {
      this.onSaveComplete(null);
    }
  }

  changeField(action: ActionType, name: string, value: any) {
    const formDataKey = this.getFormDataKey(action);

    const formData = {...this.state[formDataKey]};
    const fieldList = this.getFieldList();

    formData[name] = value;

    let callback = () => {};

    const impactedField = fieldList.find(({depends}) => {
      if (!depends?.length) {
        return false;
      }
      return depends.includes(name);
    });

    if (impactedField) {
      if (impactedField.depends?.some(dependentField => !formData[dependentField])) {
        callback = () => this.resetOptionsOfDependentField(impactedField);
      } else {
        callback = () => this.loadOptionsForDependentField(impactedField);
      }
    }
    this.setState(prevState => ({...prevState, [formDataKey]: formData}), callback);
  }

  renderField(props: Omit<GenericFieldProps, 'formState'>): React.ReactNode {
    props = {...props};
    const newProps = {
      ...props,
      formState: this.state.state,
    };
    return <GenericField key={newProps.config?.name} {...newProps} />;
  }

  renderForm(): React.ReactNode {
    switch (this.props.actionType) {
      case 'create':
        if (this.state.createFieldList) {
          return (
            <Form
              onSubmit={this.createIssue}
              submitLabel={t('Create Issue')}
              footerClass=""
            >
              {this.state.createFieldList.map(field => {
                if (field.has_autocomplete) {
                  field = Object.assign(
                    {
                      url: `/api/0/organizations/${this.getOrganization().slug}/issues/${this.getGroup().id}/plugins/${this.props.plugin.slug}/autocomplete`,
                    },
                    field
                  );
                }
                return (
                  <div key={field.name}>
                    {this.renderField({
                      config: {...field, ...this.getInputProps(field)},
                      formData: this.state.createFormData,
                      onChange: this.changeField.bind(this, 'create', field.name),
                    })}
                  </div>
                );
              })}
            </Form>
          );
        }
        break;
      case 'link':
        if (this.state.linkFieldList) {
          return (
            <Form onSubmit={this.linkIssue} submitLabel={t('Link Issue')} footerClass="">
              {this.state.linkFieldList.map(field => {
                if (field.has_autocomplete) {
                  field = Object.assign(
                    {
                      url: `/api/0/organizations/${this.getOrganization().slug}/issues/${this.getGroup().id}/plugins/${this.props.plugin.slug}/autocomplete`,
                    },
                    field
                  );
                }
                return (
                  <div key={field.name}>
                    {this.renderField({
                      config: {...field, ...this.getInputProps(field)},
                      formData: this.state.linkFormData,
                      onChange: this.changeField.bind(this, 'link', field.name),
                    })}
                  </div>
                );
              })}
            </Form>
          );
        }
        break;
      case 'unlink':
        return (
          <div>
            <p>{t('Are you sure you want to unlink this issue?')}</p>
            <Button onClick={this.unlinkIssue} variant="danger">
              {t('Unlink Issue')}
            </Button>
          </div>
        );
      default:
        return null;
    }
    return null;
  }

  getPluginConfigureUrl() {
    const org = this.getOrganization();
    const project = this.getProject();
    const plugin = this.props.plugin;
    return '/' + org.slug + '/' + project.slug + '/settings/plugins/' + plugin.slug;
  }

  renderError() {
    const error = this.state.error;
    if (!error) {
      return null;
    }
    if (error.error_type === 'auth') {
      let authUrl = error.auth_url;
      if (authUrl?.indexOf('?') === -1) {
        authUrl += '?next=' + encodeURIComponent(document.location.pathname);
      } else {
        authUrl += '&next=' + encodeURIComponent(document.location.pathname);
      }
      return (
        <Fragment>
          <Alert.Container>
            <Alert variant="info" showIcon={false}>
              {'You need to associate an identity with ' +
                this.props.plugin.name +
                ' before you can create issues with this service.'}
            </Alert>
          </Alert.Container>
          <LinkButton href={authUrl ?? '#'}>{t('Associate Identity')}</LinkButton>
        </Fragment>
      );
    }
    if (error.error_type === 'config') {
      return (
        <Alert variant="info" showIcon={false}>
          {error.has_auth_configured ? (
            <Fragment>
              You still need to{' '}
              <a href={this.getPluginConfigureUrl()}>configure this plugin</a> before you
              can use it.
            </Fragment>
          ) : (
            <div>
              <p>
                {'Your server administrator will need to configure authentication with '}
                <strong>{this.props.plugin.name}</strong>
                {' before you can use this integration.'}
              </p>
              <p>The following settings must be configured:</p>
              <ul>
                {error.required_auth_settings?.map((setting, i) => (
                  <li key={i}>
                    <code>{setting}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Alert>
      );
    }
    if (error.error_type === 'validation') {
      const errors: React.ReactElement[] = [];
      for (const name in error.errors) {
        errors.push(<p key={name}>{error.errors[name]}</p>);
      }
      return (
        <Alert variant="danger" showIcon={false}>
          {errors}
        </Alert>
      );
    }
    if (error.message) {
      return (
        <Alert variant="danger" showIcon={false}>
          {error.message}
        </Alert>
      );
    }
    return <LoadingError />;
  }

  render() {
    if (this.state.state === FormState.LOADING) {
      return <LoadingIndicator />;
    }
    return (
      <div>
        {this.renderError()}
        {this.renderForm()}
      </div>
    );
  }
}
