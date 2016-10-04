import React from 'react';

import {
  Form,
  FormState
} from '../../components/forms';
import GroupActions from '../../actions/groupActions';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';
import PluginComponentBase from '../../components/bases/pluginComponentBase';
import {t} from '../../locale';

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
      state: (['link', 'create'].includes(this.props.actionType) ?
              FormState.LOADING : FormState.READY),
      error: null,
      createFormData: {},
      linkFormData: {}
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

  componentDidMount() {
    let plugin = this.props.plugin;
    if (!plugin.issue && this.props.actionType !== 'unlink') {
      this.fetchData();
    }
  }

  getPluginCreateEndpoint() {
    return ('/issues/' + this.getGroup().id +
            '/plugins/' + this.props.plugin.slug + '/create/');
  }

  getPluginLinkEndpoint() {
    return ('/issues/' + this.getGroup().id +
            '/plugins/' + this.props.plugin.slug + '/link/');
  }

  getPluginUnlinkEndpoint() {
    return ('/issues/' + this.getGroup().id +
            '/plugins/' + this.props.plugin.slug + '/unlink/');
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
    let state = {
      loading: false
    };
    if (error.status === 400 && error.responseJSON) {
      state.error = error.responseJSON;
    } else {
      state.error = {message: t('An unknown error occurred.')};
    }
    this.setState(state);
  }

  fetchData() {
    if (this.props.actionType === 'create') {
      this.api.request(this.getPluginCreateEndpoint(), {
        success: (data) => {
          let createFormData = {};
          data.forEach((field) => {
            createFormData[field.name] = field.default;
          });
          this.setState({
            createFieldList: data,
            error: null,
            loading: false,
            createFormData: createFormData
          }, this.onLoadSuccess);
        },
        error: this.errorHandler
      });
    } else if (this.props.actionType === 'link') {
      this.api.request(this.getPluginLinkEndpoint(), {
        success: (data) => {
          let linkFormData = {};
          data.forEach((field) => {
            linkFormData[field.name] = field.default;
          });
          this.setState({
            linkFieldList: data,
            error: null,
            loading: false,
            linkFormData: linkFormData
          }, this.onLoadSuccess);
        },
        error: this.errorHandler
      });
    }
  }

  onSuccess() {
    GroupActions.updateSuccess(null, [this.getGroup().id], {stale: true});
    this.props.onSuccess && this.props.onSuccess();
  }

  createIssue() {
    this.api.request(this.getPluginCreateEndpoint(), {
      data: this.state.createFormData,
      success: this.onSuccess,
      error: this.onSaveError.bind(this, error => {
        this.setError(error, t('There was an error creating the issue.'));
      }),
      complete: this.onSaveComplete
    });
  }

  linkIssue() {
    this.api.request(this.getPluginLinkEndpoint(), {
      data: this.state.linkFormData,
      success: this.onSuccess,
      error: this.onSaveError.bind(this, error => {
        this.setError(error, t('There was an error linking the issue.'));
      }),
      complete: this.onSaveComplete
    });
  }

  unlinkIssue() {
    this.api.request(this.getPluginUnlinkEndpoint(), {
      success: this.onSuccess,
      error: this.onSaveError.bind(this, error => {
        this.setError(error, t('There was an error unlinking the issue.'));
      }),
      complete: this.onSaveComplete
    });
  }

  changeField(action, name, value) {
    let key = action + 'FormData';
    let formData = this.state[key];
    formData[name] = value;
    let state = {};
    state[key] = formData;
    this.setState(state);
  }

  renderForm() {
    let form;
    switch (this.props.actionType) {
      case 'create':
        if (this.state.createFieldList) {
          form = (
            <Form onSubmit={this.createIssue} submitLabel={t('Create Issue')}
                  footerClass="">
              {this.state.createFieldList.map((field) => {
                if (field.has_autocomplete) {
                  field = Object.assign({
                    url: ('/api/0/issues/' + this.getGroup().id +
                          '/plugins/' + this.props.plugin.slug + '/autocomplete')
                  }, field);
                }
                return (
                  <div key={field.name}>
                    {this.renderField({
                      config: field,
                      formData: this.state.createFormData,
                      onChange: this.changeField.bind(this, 'create', field.name)
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
            <Form onSubmit={this.linkIssue} submitLabel={t('Link Issue')}
                  footerClass="">
              {this.state.linkFieldList.map((field) => {
                if (field.has_autocomplete) {
                  field = Object.assign({
                    url: ('/api/0/issues/' + this.getGroup().id +
                          '/plugins/' + this.props.plugin.slug + '/autocomplete')
                  }, field);
                }
                return (
                  <div key={field.name}>
                    {this.renderField({
                      config: field,
                      formData: this.state.linkFormData,
                      onChange: this.changeField.bind(this, 'link', field.name)
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
            <button onClick={this.unlinkIssue}
                    className="btn btn-danger">{t('Unlink Issue')}</button>
          </div>
        );
        break;
      default:
        form = null;
    }
    return form;
  }

  getPluginConfigureUrl() {
    let org = this.getOrganization();
    let project = this.getProject();
    let plugin = this.props.plugin;
    return '/' + org.slug + '/' + project.slug + '/settings/plugins/' + plugin.slug;
  }

  renderError() {
    let error = this.state.error;
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
            {'You need to associate an identity with ' + error.title +
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
            {!error.has_auth_configured ?
                <div>
                  <p>{'Your server administrator will need to configure authentication with '}
                  <strong>{error.auth_provider}</strong>{' before you can use this plugin.'}</p>
                  <p>The following settings must be configured:</p>
                  <ul>{error.required_auth_settings.map((setting) => {
                    return <li><code>{setting}</code></li>;
                  })}</ul>
                </div>
              :
              <p>You still need to <a href={this.getPluginConfigureUrl()}>configure this plugin</a> before you can use it.</p>}
        </div>
      );
    } else if (error.error_type === 'validation') {
      let errors = [];
      for (let name in error.errors) {
        errors.push(<p key={name}>{error.errors[name]}</p>);
      }
      return (
        <div className="alert alert-error alert-block">
          {errors}
        </div>
      );
    } else if (error.message) {
      return (
        <div className="alert alert-error alert-block">
          <p>{error.message}</p>
        </div>
      );
    }
    return <LoadingError/>;
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
  plugin: React.PropTypes.object.isRequired,
  actionType: React.PropTypes.oneOf(['unlink', 'link', 'create']).isRequired,
  onSuccess: React.PropTypes.func
};

export default IssueActions;
