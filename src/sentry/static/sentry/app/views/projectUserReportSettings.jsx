import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import IndicatorStore from '../stores/indicatorStore';
import LoadingIndicator from '../components/loadingIndicator';
import {FormState, BooleanField} from '../components/forms';
import {t} from '../locale';

const ProjectFeedbackSettingsForm = React.createClass({
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
      if (key.lastIndexOf('feedback:') === 0) {
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
          <BooleanField
            key="branding"
            name="branding"
            label={t('Show Sentry Branding')}
            help={t('Show "powered by Sentry" within the feedback dialog. We appreciate you helping get the word out about Sentry! <3')}
            value={this.state.formData['feedback:branding']}
            error={errors['feedback:branding']}
            onChange={this.onFieldChange.bind(this, 'feedback:branding')} />
        </fieldset>
        <fieldset className="form-actions">
          <button type="submit" className="btn btn-primary"
                  disabled={isSaving}>{t('Save Changes')}</button>
        </fieldset>
      </form>
    );
  }
});

const ProjectUserReportSettings = React.createClass({
  propTypes: {
    setProjectNavSection: React.PropTypes.func
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      expected: 2,

      keyList: [],
      projectOptions: {},
    };
  },

  componentWillMount() {
    this.props.setProjectNavSection('settings');
    this.fetchData();
  },

  componentDidMount() {
    window.sentryEmbedCallback = function (embed) {
      // Mock the embed's submit xhr to always be successful
      // NOTE: this will not have errors if the form is empty
      embed.submit = function (body) {
        this._submitInProgress = true;
        setTimeout(function () {
          this._submitInProgress = false;
          this.onSuccess();
        }.bind(this), 500);
      };
    };
  },

  // TODO(dcramer): abstract this into a shared helper as its common for route handlers
  componentWillReceiveProps(nextProps) {
    let location = this.props.location;
    let nextLocation = nextProps.location;
    if (location.pathname != nextLocation.pathname || location.search != nextLocation.search) {
      this.remountComponent();
    }
  },

  componentWillUnmount() {
    window.sentryEmbedCallback = null;
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
          error: true,
          expected: expected,
          loading: expected > 0,
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
    let dsn = (this.state.keyList.length ?
      this.state.keyList[0].dsn.public :
      'https://public@sentry.example.com/1');

    return (
      '<!-- Sentry JS SDK 2.1.+ required -->\n' +
      '<script src="https://cdn.ravenjs.com/2.1.0/raven.min.js"></script>\n\n' +
      '{% if request.sentry.id %}\n' +
      '  <script>\n' +
      '  Raven.showReportDialog({\n' +
      '    // grab the eventId generated by the Sentry SDK\n' +
      '    eventId: \'{{ request.sentry.id }}\',\n\n' +
      '    // use the public DSN (dont include your secret!)\n' +
      '    dsn: \'' + dsn + '\'\n' +
      '  });\n' +
      '  </script>\n' +
      '{% endif %}\n'
    );
  },

  getBrowserJSInstructions() {
    let dsn = (this.state.keyList.length ?
      this.state.keyList[0].dsn.public :
      'https://public@sentry.example.com/1');

    return (
      '<!-- Sentry JS SDK 2.1.+ required -->\n' +
      '<script src="https://cdn.ravenjs.com/2.1.0/raven.min.js"></script>\n\n' +
      '<script>\n' +
      '// configure the SDK as you normally would\n' +
      'Raven.config(\'' + dsn + '\').install();\n\n' +
      '/**\n' +
      ' * Report a routing error to Sentry and show a feedback dialog to\n' +
      ' * the user.\n' +
      ' * \n' +
      ' * > try {\n' +
      ' * >   renderRoute()\n' +
      ' * > } catch (err) {\n' +
      ' * >   handleRouteError(err);\n' +
      ' * > }\n' +
      ' */\n' +
      'function handleRouteError(err) {\n' +
      '  Raven.captureException(err);\n' +
      '  Raven.showReportDialog();\n' +
      '};\n' +
      '</script>\n'
    );
  },

  handleClick() {
    Raven.showReportDialog({
      // should never make it to the Sentry API, but just in case, use throwaway id
      eventId: '00000000000000000000000000000000'
    });
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
        <h1>{t('User Feedback')}</h1>

        <div className="alert alert-block alert-info">Psst! This feature is still a work-in-progress. Thanks for being an early adopter!</div>

        <p>Enabling User Feedback allows you to interact with your users on an unprecedented level. Collect additional details about issues affecting them, and more importantly reach out to them with resolutions.</p>
        <p>When configured, your users will be presented with a dialog prompting them for additional information. That information will get attached to the issue in Sentry</p>
        <p><a className="btn btn-primary" onClick={this.handleClick}>See the report dialog in action</a></p>

        <div className="box">
          <div className="box-header">
            <h3>{t('Integration')}</h3>
          </div>
          <div className="box-content with-padding">
            <p>The following example uses our Django integration. Check the documentation for the SDK you're using for more details.</p>
            <pre>{this.getInstructions()}</pre>
            <p>If you're capturing an error with our Browser JS SDK, things get even simpler:</p>
            <pre>{this.getBrowserJSInstructions()}</pre>
          </div>
        </div>

        <div className="box">
          <div className="box-header">
            <h3>{t('Settings')}</h3>
          </div>
          <div className="box-content with-padding">
            <ProjectFeedbackSettingsForm
              orgId={orgId}
              projectId={projectId}
              initialData={this.state.projectOptions} />
          </div>
        </div>

      </div>
    );
  }
});

export default ProjectUserReportSettings;
