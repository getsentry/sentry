import React from 'react';

import {t} from '../locale';

const ProjectUserReportSettings = React.createClass({
  propTypes: {
    setProjectNavSection: React.PropTypes.func
  },

  componentWillMount() {
    this.props.setProjectNavSection('settings');
  },

  getInstructions() {
    return (
      '<!-- Sentry JS SDK 2.1.+ required -->\n' +
      '<script src="https://cdn.ravenjs.com/2.1.0/raven.min.js"></script>\n\n' +
      '{% if request.sentry.id %}\n' +
      '  <script>\n' +
      '  Raven.showErrorDialog(\'{{ request.sentry.id }}\', {\n' +
      '    // use the public DSN (dont include your secret!)\n' +
      '    dsn: \'https://public@sentry.example.com/1\'\n' +
      '  })\n' +
      '  </script>\n' +
      '{% endif %}\n'
    );
  },

  render() {
    // TODO(dcramer): localize when language is final
    return (
      <div>
        <h1>{t('User Reports')}</h1>

        <p>Enabling User Reports allows you to interact with your users on an unprecedented level. Collect additional details about issues affecting them, and more importantly reach out to them with resolutions.</p>

        <p>When configured, your users will be presented with a dialog prompting them for additional information. That information will get attached to the issue in Sentry</p>

        <p>The following example uses our Django integration. Check the documentation for the SDK you're using for more details.</p>

        <pre>{this.getInstructions()}</pre>
      </div>
    );
  }
});

export default ProjectUserReportSettings;
