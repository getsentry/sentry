import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import LoadingIndicator from '../components/loadingIndicator';
import {t} from '../locale';

const ProjectCspSettings = React.createClass({
  propTypes: {
    setProjectNavSection: React.PropTypes.func
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      keyList: [],
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
        this.setState({
          error: false,
          loading: false,
          keyList: data,
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
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

    // TODO(dcramer): localize when language is final
    return (
      <div>
        <h1>{t('CSP Reports')}</h1>

        <div className="alert alert-block alert-info">Psst! This feature is still a work-in-progress. Thanks for being an early adopter!</div>

        <p><a href="https://en.wikipedia.org/wiki/Content_Security_Policy">Content Security Policy</a> (CSP) is a security standard which helps prevent cross-site scripting (XSS), clickjacking and other code injection attacks resulting from execution of malicious content in the trusted web page context. It's enforced by browser vendors, and Sentry supports capturing CSP violations using the standard reporting hooks.</p>

        <p>To configure <acronym title="Content Security Policy">CSP</acronym> reports in Sentry, you'll need to send a header from your server describing your policy, as well specifying the authenticated Sentry endpoint.</p>

        <p>For example, in Python you might achieve this via a simple web middleware:</p>

        <pre>{this.getInstructions()}</pre>

        <p>Additionally you can setup CSP reports to simply send reports rather than actually enforcing the policy:</p>

        <pre>{this.getReportOnlyInstructions()}</pre>

        <p>We recommend setting this up to only run on a percentage of requests, as otherwise you may find that you've quickly exhausted your quota. For more information, take a look at <a href="http://www.html5rocks.com/en/tutorials/security/content-security-policy/">the article on html5rocks.com</a>.</p>
      </div>
    );
  }
});

export default ProjectCspSettings;
