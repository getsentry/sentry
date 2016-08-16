import React from 'react';
import AlertActions from '../../actions/alertActions';
import ApiMixin from '../../mixins/apiMixin';
import {Form, Select2Field, Select2FieldAutocomplete, TextareaField, TextField} from '../forms';
import LoadingIndicator from '../loadingIndicator';
import {t} from '../../locale';
import {defined} from '../../utils';

const PluginConfigForm = React.createClass({
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
    return (
      `/projects/${org.slug}/${project.slug}/plugin/${this.props.plugin.slug}/configure/`
    );
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
    let required = defined(field.required) ? field.required : true;
    let props = {
      value: this.state.formData[field.name],
      onChange: this.changeField.bind(this, field.name),
      label: field.label + (required ? '*' : ''),
      placeholder: field.placeholder,
      name: field.name,
      disabled: field.readonly,
      help: <span dangerouslySetInnerHTML={{__html: field.help}}/>
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
          el = <Select2FieldAutocomplete {...props} />;
        } else {
          props.choices = field.choices;
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
        AlertActions.addAlert({
          message: t('Successfully saved plugin settings.'),
          type: 'success'
        });
      },
      error: (error) => {
        AlertActions.addAlert({
          message: t('There was an error saving the plugin configuration.'),
          type: 'error'
        });
      }
    });
  },

  render() {
    if (!this.state.fieldList) {
      return <LoadingIndicator />;
    }
    return (
      <Form onSubmit={this.onSubmit}>
        {this.state.fieldList.map((field) => {
          return <div key={field.name}>{this.renderField(field)}</div>;
        })}
      </Form>
    );
  }
});

export default PluginConfigForm;
