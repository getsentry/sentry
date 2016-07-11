import React from 'react';
import AlertActions from '../actions/alertActions';
import ApiMixin from '../mixins/apiMixin';
import {Form, Select2Field, TextareaField, TextField} from '../components/forms';
import {t} from '../locale';

const IssuePluginConfigForm = React.createClass({
  propTypes: {
    organization: React.PropTypes.object.isRequired,
    project: React.PropTypes.object.isRequired,
    plugin: React.PropTypes.object
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      fieldList: null,
      formData: null
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  getPluginConfigureEndpoint() {
    let org = this.props.organization;
    let project = this.props.project;
    return ('/projects/' + org.slug + '/' + project.slug +
            '/plugin/configure/' + this.props.plugin.slug + '/');
  },

  getPluginDisableEndpoint() {
    let org = this.props.organization;
    let project = this.props.project;
    return ('/projects/' + org.slug + '/' + project.slug +
            '/plugin/disable/' + this.props.plugin.slug + '/');
  },

  fetchData() {
    this.api.request(this.getPluginConfigureEndpoint(), {
      success: (data) => {
        let formData = {};
        data.forEach((field) => {
          formData[field.name] = field.default;
        });
        this.setState({
          fieldList: data,
          error: false,
          loading: false,
          formData: formData
        });
      },
      error: (error) => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  changeField(name, value) {
    let formData = this.state.formData;
    formData[name] = value;
    this.setState({formData: formData});
  },

  renderField(field) {
    let el;
    let props = {
      value: this.state.formData[field.name],
      onChange: this.changeField.bind(this, field.name),
      label: field.label,
      placeholder: field.placeholder,
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

  onSubmit() {
    this.api.request(this.getPluginConfigureEndpoint(), {
      data: this.state.formData,
      success: (data) => {
        // TODO
      },
      error: (error) => {
        // TODO
      }
    });
  },

  disablePlugin() {
    this.api.request(this.getPluginDisableEndpoint(), {
      success: (data) => {
        // TODO: when this whole page is a react view, this won't be necessary
        window.location.reload();
      },
      error: (error) => {
        AlertActions.addAlert({
          message: t('There was an error disabling the plugin'),
          type: 'error'
        });
      }
    });
  },

  render() {
    if (!this.state.fieldList) {
      // TODO: loading
      return null;
    }
    return (
      <div className="box">
        <div className="box-header">
          {this.props.plugin.can_disable && this.props.plugin.is_enabled &&
            <button className="btn btn-sm btn-default pull-right" onClick={this.disablePlugin}>{t('Disable')}</button>}
          <h3>{this.props.plugin.title}</h3>
        </div>
        <div className="box-content with-padding">
          <Form onSubmit={this.onSubmit}>
            {this.state.fieldList.map((field) => {
              return <div key={field.name}>{this.renderField(field)}</div>;
            })}
          </Form>
        </div>
      </div>
    );
  }
});


const IssuePluginConfiguration = React.createClass({
  propTypes: {
    organization: React.PropTypes.object.isRequired,
    project: React.PropTypes.object.isRequired,
    plugins: React.PropTypes.array.isRequired
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: false,
      error: false,
    };
  },

  render() {
    if (!this.props.plugins.length) {
      return null;
    }
    return (
      <div>{this.props.plugins.map((plugin) => {
        return <IssuePluginConfigForm plugin={plugin} key={plugin.slug} {...this.props}/>;
      })}</div>);
  }

});

export default IssuePluginConfiguration;
