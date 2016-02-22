import React from 'react';

import {t} from '../locale';

const ProjectUserReportSettings = React.createClass({
  propTypes: {
    setProjectNavSection: React.PropTypes.func
  },

  componentWillMount() {
    this.props.setProjectNavSection('settings');
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

  componentWillUnmount() {
    window.sentryEmbedCallback = null;
  },

  getInstructions() {
    return (
      '<!-- Sentry JS SDK 2.1.+ required -->\n' +
      '<script src="https://cdn.ravenjs.com/2.1.0/raven.min.js"></script>\n\n' +
      '{% if request.sentry.id %}\n' +
      '  <script>\n' +
      '  Raven.showReportDialog({\n' +
      '    eventId: \'{{ request.sentry.id }}\',\n\n' +
      '    // use the public DSN (dont include your secret!)\n' +
      '    dsn: \'https://public@sentry.example.com/1\'\n' +
      '  });\n' +
      '  </script>\n' +
      '{% endif %}\n'
    );
  },

  handleClick() {
    Raven.showReportDialog({
      // should never make it to the Sentry API, but just in case, use throwaway id
      eventId: 'ignoreme'
    });
  },

  render() {
    // TODO(dcramer): localize when language is final
    return (
      <div>
        <h1>{t('User Reports')}</h1>

        <div className="alert alert-block alert-info">Psst! This feature is still a work-in-progress. Thanks for being an early adopter!</div>

        <p>Enabling User Reports allows you to interact with your users on an unprecedented level. Collect additional details about issues affecting them, and more importantly reach out to them with resolutions.</p>

        <p>When configured, your users will be presented with a dialog prompting them for additional information. That information will get attached to the issue in Sentry</p>

        <p>The following example uses our Django integration. Check the documentation for the SDK you're using for more details.</p>

        <pre>{this.getInstructions()}</pre>

        <p><a className="btn btn-primary" onClick={this.handleClick}>See the report dialog in action</a></p>
      </div>
    );
  }
});

export default ProjectUserReportSettings;
