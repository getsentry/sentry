import React from 'react';
import AlertActions from '../actions/alertActions';
import ApiMixin from '../mixins/apiMixin';
import {BooleanField, Form, Select2Field, TextareaField, TextField} from '../components/forms';
import GroupActions from '../actions/groupActions';
import GroupState from '../mixins/groupState';
import {t} from '../locale';

const IssuePlugin = React.createClass({
  mixins: [
    ApiMixin,
    GroupState
  ],

  getInitialState() {
    return {
      createFieldList: null,
      linkFieldList: null,
      createIssue: true,
      loading: true,
      error: false,
      createFormData: {},
      linkFormData: {}
    };
  },

  componentWillMount() {
    // TODO: does this need to work with multiple plugins?
    let group = this.getGroup();
    let plugin = group.pluginIssues && group.pluginIssues[0];
    if (group.pluginIssues && group.pluginIssues.length) {
      if (!plugin.issue) {
        this.fetchData(group.pluginIssues[0].slug);
      }
    }
  },

  getPluginCreateEndpoint(pluginSlug) {
    return '/issues/' + this.getGroup().id + '/plugin/create/github/';
  },

  getPluginLinkEndpoint(pluginSlug) {
    return '/issues/' + this.getGroup().id + '/plugin/link/github/';
  },

  getPluginUnlinkEndpoint(pluginSlug) {
    return '/issues/' + this.getGroup().id + '/plugin/unlink/github/';
  },

  fetchData(pluginSlug) {
    this.setState({
      loading: true,
      error: false
    });

    this.api.request(this.getPluginCreateEndpoint(), {
      success: (data) => {
        if (!this.isMounted()) {
          return;
        }
        let createFormData = {};
        data.forEach((field) => {
          createFormData[field.name] = field.default;
        });
        this.setState({
          createFieldList: data,
          error: false,
          loading: false,
          createFormData: createFormData
        });
      },
      error: (error) => {
        if (!this.isMounted()) {
          return;
        }
        this.setState({
          error: true,
          loading: false
        });
      }
    });

    this.api.request(this.getPluginLinkEndpoint(), {
      success: (data) => {
        if (!this.isMounted()) {
          return;
        }
        let linkFormData = {};
        data.forEach((field) => {
          linkFormData[field.name] = field.default;
        });
        this.setState({
          linkFieldList: data,
          error: false,
          loading: false,
          linkFormData: linkFormData
        });
      },
      error: (error) => {
        if (!this.isMounted()) {
          return;
        }
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  createIssue() {
    this.api.request(this.getPluginCreateEndpoint(), {
      data: this.state.createFormData,
      success: (data) => {
        GroupActions.groupPluginChange(this.getGroup().id);
        AlertActions.addAlert({
          message: t('Successfully created issue.'),
          type: 'success'
        });
      },
      error: (error) => {
        AlertActions.addAlert({
          message: t('There was an error creating the issue.'),
          type: 'error'
        });
      }
    });
  },

  linkIssue() {
    this.api.request(this.getPluginLinkEndpoint(), {
      data: this.state.linkFormData,
      success: (data) => {
        GroupActions.groupPluginChange(this.getGroup().id);
        AlertActions.addAlert({
          message: t('Successfully linked issue.'),
          type: 'success'
        });
      },
      error: (error) => {
        AlertActions.addAlert({
          message: t('There was an error linking the issue.'),
          type: 'error'
        });
      }
    });
  },

  unlinkIssue() {
    this.api.request(this.getPluginUnlinkEndpoint(), {
      success: (data) => {
        GroupActions.groupPluginChange(this.getGroup().id);
        AlertActions.addAlert({
          message: t('Successfully unlinked issue.'),
          type: 'success'
        });
        this.fetchData();
      },
      error: (error) => {
        AlertActions.addAlert({
          message: t('There was an error unlinking the issue.'),
          type: 'error'
        });
      }
    });
  },

  changeField(action, name, value) {
    let key = action + 'FormData';
    let formData = this.state[key];
    formData[name] = value;
    let state = {};
    state[key] = formData;
    this.setState(state);
  },

  renderField(action, field) {
    let el;
    let props = {
      value: this.state[action + 'FormData'][field.name],
      onChange: this.changeField.bind(this, action, field.name),
      label: field.label,
      name: field.name
    };
    switch (field.type) {
      case 'text':
        el = <TextField {...props} />;
        break;
      case 'textarea':
        el = <TextareaField {...props} />;
        break;
      case 'select':
        if (field.has_autocomplete) {
          el = <Select2Field {...props} />;
        }
        break;
      default:
        el = null;
    }
    return el;
  },

  toggleIssueForm(value) {
    this.setState({createIssue: value});
  },

  renderForm() {
    return (
      <div>
        <div>
          <BooleanField label={t('Create new issue')}
                        name="is_create"
                        value={this.state.createIssue}
                        onChange={this.toggleIssueForm}/>
        </div>
        {this.state.createIssue ?
          <Form onSubmit={this.createIssue}>
            {this.state.createFieldList.map((field) => {
              return <div key={field.name}>{this.renderField('create', field)}</div>;
            })}
          </Form> :
          <Form onSubmit={this.linkIssue}>
            {this.state.linkFieldList.map((field) => {
              return <div key={field.name}>{this.renderField('link', field)}</div>;
            })}
          </Form>
        }
      </div>
    );
  },

  render() {
    // TODO: does this need to work with multiple plugins?
    let group = this.getGroup();
    let plugin = group.pluginIssues && group.pluginIssues[0];
    if (plugin.issue) {
      return (
        <div>
          <a href={plugin.issue.url} target="_blank">{plugin.issue.label}</a>
          {plugin.can_unlink &&
            <button className="btn btn-primary"
                    onClick={this.unlinkIssue}>{t('Unlink')}</button>}
        </div>);
    }
    if (!this.state.createFieldList || (plugin.can_link_existing && !this.state.linkFieldList)) {
      // TODO: loading
      return null;
    }
    return this.renderForm();
  }
});

export default IssuePlugin;
