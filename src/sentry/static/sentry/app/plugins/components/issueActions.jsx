import PropTypes from 'prop-types';
import React from 'react';

import {Form, FormState} from 'app/components/forms';
import GroupActions from 'app/actions/groupActions';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import PluginComponentBase from 'app/components/bases/pluginComponentBase';
import {t} from 'app/locale';

class IssueActions extends PluginComponentBase {
  constructor(props) {
    super(props);

    this.createIssue = this.onSave.bind(this, this.createIssue.bind(this));
    this.linkIssue = this.onSave.bind(this, this.linkIssue.bind(this));
    this.unlinkIssue = this.onSave.bind(this, this.unlinkIssue.bind(this));
    this.onSuccess = this.onSaveSuccess.bind(this, this.onSuccess.bind(this));
    this.errorHandler = this.onLoadError.bind(this, this.errorHandler.bind(this));

    Object.assign(this.state, {
      createFieldList: null,
      linkFieldList: null,
      loading: ['link', 'create'].includes(this.props.actionType),
      state: ['link', 'create'].includes(this.props.actionType)
        ? FormState.LOADING
        : FormState.READY,
      error: null,
      createFormData: {},
      linkFormData: {},
      dependentFieldState: {},
    });
  }

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
    return this.props.actionType + 'FieldList';
  }

  getFormDataKey() {
    return this.props.actionType + 'FormData';
  }

  getFormData() {
    const key = this.getFormDataKey();
    return this.state[key] || {};
  }

  getFieldList() {
    const key = this.getFieldListKey();
    return this.state[key] || [];
  }

  componentDidMount() {
    const plugin = this.props.plugin;
    if (!plugin.issue && this.props.actionType !== 'unlink') {
      this.fetchData();
    }
  }

  getPluginCreateEndpoint() {
    return (
      '/issues/' + this.getGroup().id + '/plugins/' + this.props.plugin.slug + '/create/'
    );
  }

  getPluginLinkEndpoint() {
    return (
      '/issues/' + this.getGroup().id + '/plugins/' + this.props.plugin.slug + '/link/'
    );
  }

  getPluginUnlinkEndpoint() {
    return (
      '/issues/' + this.getGroup().id + '/plugins/' + this.props.plugin.slug + '/unlink/'
    );
  }

  setDependentFieldState(fieldName, state) {
    const dependentFieldState = {...this.state.dependentFieldState, [fieldName]: state};
    this.setState({dependentFieldState});
  }

  loadOptionsForDependentField = async field => {
    const formData = this.getFormData();

    const groupId = this.getGroup().id;
    const pluginSlug = this.props.plugin.slug;
    const url = `/issues/${groupId}/plugins/${pluginSlug}/options/`;

    //find the fields that this field is dependent on
    const dependentFormValues = Object.fromEntries(
      field.depends.map(fieldKey => [fieldKey, formData[fieldKey]])
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

  updateOptionsOfDependentField = (field, choices) => {
    const formListKey = this.getFieldListKey();
    let fieldList = this.state[formListKey];

    //find the location of the field in our list and replace it
    const indexOfField = fieldList.findIndex(({name}) => name === field.name);
    field = {...field, choices};

    //make a copy of the array to avoid mutation
    fieldList = fieldList.slice();
    fieldList[indexOfField] = field;

    this.setState({[formListKey]: fieldList});
  };

  resetOptionsOfDependentField = field => {
    this.updateOptionsOfDependentField(field, []);
    const formDataKey = this.getFormDataKey();
    const formData = {...this.state[formDataKey]};
    formData[field.name] = '';
    this.setState({[formDataKey]: formData});
    this.setDependentFieldState(field.name, FormState.DISABLED);
  };

  getInputProps(field) {
    const props = {};

    //special logic for fields that have dependencies
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

  setError(error, defaultMessage) {
    let errorBody;
    if (error.status === 400 && error.responseJSON) {
      errorBody = error.responseJSON;
    } else {
      errorBody = {message: defaultMessage};
    }
    this.setState({error: errorBody});
  }

  errorHandler(error) {
    const state = {
      loading: false,
    };
    if (error.status === 400 && error.responseJSON) {
      state.error = error.responseJSON;
    } else {
      state.error = {message: t('An unknown error occurred.')};
    }
    this.setState(state);
  }

  onLoadSuccess(...args) {
    super.onLoadSuccess(...args);

    //dependent fields need to be set to disabled upon loading
    const fieldList = this.getFieldList();
    fieldList.forEach(field => {
      if (field.depends && field.depends.length > 0) {
        this.setDependentFieldState(field.name, FormState.DISABLED);
      }
    });
  }

  fetchData() {
    if (this.props.actionType === 'create') {
      this.api.request(this.getPluginCreateEndpoint(), {
        success: data => {
          const createFormData = {};
          data.forEach(field => {
            createFormData[field.name] = field.default;
          });
          this.setState(
            {
              createFieldList: data,
              error: null,
              loading: false,
              createFormData,
            },
            this.onLoadSuccess
          );
        },
        error: this.errorHandler,
      });
    } else if (this.props.actionType === 'link') {
      this.api.request(this.getPluginLinkEndpoint(), {
        success: data => {
          const linkFormData = {};
          data.forEach(field => {
            linkFormData[field.name] = field.default;
          });
          this.setState(
            {
              linkFieldList: data,
              error: null,
              loading: false,
              linkFormData,
            },
            this.onLoadSuccess
          );
        },
        error: this.errorHandler,
      });
    }
  }

  onSuccess(data) {
    GroupActions.updateSuccess(null, [this.getGroup().id], {stale: true});
    this.props.onSuccess && this.props.onSuccess(data);
  }

  createIssue() {
    this.api.request(this.getPluginCreateEndpoint(), {
      data: this.state.createFormData,
      success: this.onSuccess,
      error: this.onSaveError.bind(this, error => {
        this.setError(error, t('There was an error creating the issue.'));
      }),
      complete: this.onSaveComplete,
    });
  }

  linkIssue() {
    this.api.request(this.getPluginLinkEndpoint(), {
      data: this.state.linkFormData,
      success: this.onSuccess,
      error: this.onSaveError.bind(this, error => {
        this.setError(error, t('There was an error linking the issue.'));
      }),
      complete: this.onSaveComplete,
    });
  }

  unlinkIssue() {
    this.api.request(this.getPluginUnlinkEndpoint(), {
      success: this.onSuccess,
      error: this.onSaveError.bind(this, error => {
        this.setError(error, t('There was an error unlinking the issue.'));
      }),
      complete: this.onSaveComplete,
    });
  }

  changeField(action, name, value) {
    const formDataKey = action + 'FormData';

    //copy so we don't mutate
    const formData = {...this.state[formDataKey]};
    const fieldList = this.getFieldList();

    formData[name] = value;

    let callback = () => {};

    //only works with one impacted field
    const impactedField = fieldList.find(({depends}) => {
      if (!depends || !depends.length) {
        return false;
      }
      // must be dependent on the field we just set
      return depends.includes(name);
    });

    if (impactedField) {
      //if every dependent field is set, then search
      if (!impactedField.depends.some(dependentField => !formData[dependentField])) {
        callback = () => this.loadOptionsForDependentField(impactedField);
      } else {
        //otherwise reset the options
        callback = () => this.resetOptionsOfDependentField(impactedField);
      }
    }

    this.setState({[formDataKey]: formData}, callback);
  }

  renderForm() {
    let form;
    switch (this.props.actionType) {
      case 'create':
        if (this.state.createFieldList) {
          form = (
            <Form
              onSubmit={this.createIssue}
              submitLabel={t('Create Issue')}
              footerClass=""
            >
              {this.state.createFieldList.map(field => {
                if (field.has_autocomplete) {
                  field = Object.assign(
                    {
                      url:
                        '/api/0/issues/' +
                        this.getGroup().id +
                        '/plugins/' +
                        this.props.plugin.slug +
                        '/autocomplete',
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
          form = (
            <Form onSubmit={this.linkIssue} submitLabel={t('Link Issue')} footerClass="">
              {this.state.linkFieldList.map(field => {
                if (field.has_autocomplete) {
                  field = Object.assign(
                    {
                      url:
                        '/api/0/issues/' +
                        this.getGroup().id +
                        '/plugins/' +
                        this.props.plugin.slug +
                        '/autocomplete',
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
        form = (
          <div>
            <p>{t('Are you sure you want to unlink this issue?')}</p>
            <button onClick={this.unlinkIssue} className="btn btn-danger">
              {t('Unlink Issue')}
            </button>
          </div>
        );
        break;
      default:
        form = null;
    }
    return form;
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
      if (authUrl.indexOf('?') === -1) {
        authUrl += '?next=' + encodeURIComponent(document.location.pathname);
      } else {
        authUrl += '&next=' + encodeURIComponent(document.location.pathname);
      }
      return (
        <div>
          <div className="alert alert-warning m-b-1">
            {'You need to associate an identity with ' +
              this.props.plugin.name +
              ' before you can create issues with this service.'}
          </div>
          <a className="btn btn-primary" href={authUrl}>
            Associate Identity
          </a>
        </div>
      );
    } else if (error.error_type === 'config') {
      return (
        <div className="alert alert-block">
          {!error.has_auth_configured ? (
            <div>
              <p>
                {'Your server administrator will need to configure authentication with '}
                <strong>{this.props.plugin.name}</strong>
                {' before you can use this integration.'}
              </p>
              <p>The following settings must be configured:</p>
              <ul>
                {error.required_auth_settings.map((setting, i) => {
                  return (
                    <li key={i}>
                      <code>{setting}</code>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p>
              You still need to{' '}
              <a href={this.getPluginConfigureUrl()}>configure this plugin</a> before you
              can use it.
            </p>
          )}
        </div>
      );
    } else if (error.error_type === 'validation') {
      const errors = [];
      for (const name in error.errors) {
        errors.push(<p key={name}>{error.errors[name]}</p>);
      }
      return <div className="alert alert-error alert-block">{errors}</div>;
    } else if (error.message) {
      return (
        <div className="alert alert-error alert-block">
          <p>{error.message}</p>
        </div>
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

IssueActions.propTypes = {
  plugin: PropTypes.object.isRequired,
  actionType: PropTypes.oneOf(['unlink', 'link', 'create']).isRequired,
  onSuccess: PropTypes.func,
};

export default IssueActions;
