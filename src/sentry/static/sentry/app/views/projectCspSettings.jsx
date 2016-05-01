import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import IndicatorStore from '../stores/indicatorStore';
import LoadingIndicator from '../components/loadingIndicator';
import {TextareaField, CheckboxField} from '../components/forms';
import {t} from '../locale';

const FormState = {
  READY: 0,
  SAVING: 1,
  ERROR: 2,
};

const ProjectCspSettingsForm = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    initialData: React.PropTypes.object.isRequired
  },

  mixins: [ApiMixin],

  getInitialState() {
    let formData = {};
    // We only want to work with a certain set of project options here
    for (let key of Object.keys(this.props.initialData)) {
      if (key.lastIndexOf('sentry:csp_') === 0) {
        formData[key] = this.props.initialData[key];
      }
    }
    return {
      formData: formData,
      errors: {},
    };
  },

  onFieldChange(name, value) {
    let formData = this.state.formData;
    formData[name] = value;
    this.setState({
      formData: formData,
    });
  },

  onSubmit(e) {
    e.preventDefault();

    if (this.state.state === FormState.SAVING) {
      return;
    }
    this.setState({
      state: FormState.SAVING,
    }, () => {
      let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
      let {orgId, projectId} = this.props;
      this.api.request(`/projects/${orgId}/${projectId}/`, {
        method: 'PUT',
        data: {options: this.state.formData},
        success: (data) => {
          this.setState({
            state: FormState.READY,
            errors: {},
          });
        },
        error: (error) => {
          this.setState({
            state: FormState.ERROR,
            errors: error.responseJSON,
          });
        },
        complete: () => {
          IndicatorStore.remove(loadingIndicator);
        }
      });
    });
  },

  render() {
    let isSaving = this.state.state === FormState.SAVING;
    let errors = this.state.errors;
    return (
      <form onSubmit={this.onSubmit} className="form-stacked">
        {this.state.state === FormState.ERROR &&
          <div className="alert alert-error alert-block">
            {t('Unable to save your changes. Please ensure all fields are valid and try again.')}
          </div>
        }
        <fieldset>
          <CheckboxField
            key="ignored-sources-defaults"
            name="ignored-sources-defaults"
            label={t('Use Default Ignored Sources')}
            help={t('Our default list will attempt to ignore common issues and reduce noise.')}
            value={this.state.formData['sentry:csp_ignored_sources_defaults']}
            error={errors['sentry:csp_ignored_sources_defaults']}
            onChange={this.onFieldChange.bind(this, 'sentry:csp_ignored_sources_defaults')} />
          <TextareaField
            key="ignored-sources"
            name="ignored-sources"
            rows={5}
            label={t('Additional Ignored Sources')}
            help={t('Separate multiple entries with a newline.')}
            value={this.state.formData['sentry:csp_ignored_sources']}
            placeholder="e.g. file://*, *.example.com, example.com, etc"
            error={errors['sentry:csp_ignored_sources']}
            onChange={this.onFieldChange.bind(this, 'sentry:csp_ignored_sources')} />
        </fieldset>
        <fieldset className="form-actions">
          <button type="submit" className="btn btn-primary"
                  disabled={isSaving}>{t('Save Changes')}</button>
        </fieldset>
      </form>
    );
  }
});

const ProjectCspSettings = React.createClass({
  propTypes: {
    setProjectNavSection: React.PropTypes.func
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      expected: 2,
      error: false,
      keyList: [],
      projectOptions: {},
    };
  },

  componentWillMount() {
    this.props.setProjectNavSection('settings');
    this.fetchData();
  },

  // TODO(dcramer): abstract this into a shared helper as its common for route handlers
  componentWillReceiveProps(nextProps) {
    let location = this.props.location;
    let nextLocation = nextProps.location;
    if (location.pathname != nextLocation.pathname || location.search != nextLocation.search) {
      this.remountComponent();
    }
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  fetchData() {
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/keys/`, {
      success: (data, _, jqXHR) => {
        let expected = this.state.expected - 1;
        this.setState({
          expected: expected,
          loading: expected > 0,
          keyList: data,
        });
      },
      error: () => {
        let expected = this.state.expected - 1;
        this.setState({
          expected: expected,
          error: true,
          loading: expected > 0
        });
      }
    });

    this.api.request(`/projects/${orgId}/${projectId}/`, {
      success: (data, _, jqXHR) => {
        let expected = this.state.expected - 1;
        this.setState({
          expected: expected,
          loading: expected > 0,
          projectOptions: data.options,
        });
      },
      error: () => {
        let expected = this.state.expected - 1;
        this.setState({
          expected: expected,
          error: true,
          loading: expected > 0
        });
      }
    });
  },

  getInstructions() {
    let endpoint = (this.state.keyList.length ?
      this.state.keyList[0].dsn.csp :
      'https://sentry.example.com/api/csp-report/');

    return (
      'def middleware(request, response):\n' +
      '    response[\'Content-Security-Policy\'] = \\\n' +
      '        \"default-src *; \" \\\n' +
      '        \"script-src \'self\' \'unsafe-eval\' \'unsafe-inline\' cdn.example.com cdn.ravenjs.com; \" \\\n' +
      '        \"style-src \'self\' \'unsafe-inline\' cdn.example.com; \" \\\n' +
      '        \"img-src * data:; \" \\\n' +
      '        \"report-uri ' + endpoint + '\"\n' +
      '    return response\n'
    );
  },

  getReportOnlyInstructions() {
    let endpoint = (this.state.keyList.length ?
      this.state.keyList[0].dsn.csp :
      'https://sentry.example.com/api/csp-report/');

    return (
      'def middleware(request, response):\n' +
      '    response[\'Content-Security-Policy-Report-Only\'] = \\\n' +
      '        \"default-src \'self\'; \" \\\n' +
      '        \"report-uri ' + endpoint + '\"\n' +
      '    return response\n'
    );
  },

  renderLoading() {
    return (
      <div className="box">
        <LoadingIndicator />
      </div>
    );
  },

  render() {
    if (this.state.loading)
      return this.renderLoading();

    let {orgId, projectId} = this.props.params;

    // TODO(dcramer): localize when language is final
    return (
      <div>
        <h1>{t('CSP Reports')}</h1>

        <div className="alert alert-block alert-info">Psst! This feature is still a work-in-progress. Thanks for being an early adopter!</div>

        <p><a href="https://en.wikipedia.org/wiki/Content_Security_Policy">Content Security Policy</a> (CSP) is a security standard which helps prevent cross-site scripting (XSS), clickjacking and other code injection attacks resulting from execution of malicious content in the trusted web page context. It's enforced by browser vendors, and Sentry supports capturing CSP violations using the standard reporting hooks.</p>

        <div className="box">
          <div className="box-header">
            <h3>{t('Settings')}</h3>
          </div>
          <div className="box-content with-padding">
            <ProjectCspSettingsForm
              orgId={orgId}
              projectId={projectId}
              initialData={this.state.projectOptions} />
          </div>
        </div>


        <div className="box">
          <div className="box-header">
            <h3>{t('Integration')}</h3>
          </div>

          <div className="box-content with-padding">
            <p>To configure <acronym title="Content Security Policy">CSP</acronym> reports in Sentry, you'll need to send a header from your server describing your policy, as well specifying the authenticated Sentry endpoint.</p>

            <p>For example, in Python you might achieve this via a simple web middleware:</p>

            <pre>{this.getInstructions()}</pre>

            <p>Alternatively you can setup CSP reports to simply send reports rather than actually enforcing the policy:</p>

            <pre>{this.getReportOnlyInstructions()}</pre>

            <p>We recommend setting this up to only run on a percentage of requests, as otherwise you may find that you've quickly exhausted your quota. For more information, take a look at <a href="http://www.html5rocks.com/en/tutorials/security/content-security-policy/">the article on html5rocks.com</a>.</p>
          </div>
        </div>
      </div>
    );
  }
});

export default ProjectCspSettings;
