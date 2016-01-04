import jQuery from 'jquery';
import Raven from 'raven-js';
import React from 'react';

import ConfigStore from '../stores/configStore';


function loadScript(url) {
  let script = document.createElement('script');
  script.type = 'text/javascript';
  script.async = true;
  script.src = url;
  (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(script);
}

const RouteError = React.createClass({
  componentWillMount() {
    // TODO(dcramer): show something in addition to embed (that contains it?)
    // TODO(dcramer): capture better context
    Raven.captureException(this.props.error);
    this.setState({
      errorId: Raven.lastEventId(),
    }, () => {
      loadScript(this.getCrashReportUrl());
    });
  },

  componentWillUnmount() {
    // TODO(dcramer): kill crash dialog
  },

  getCrashReportUrl() {
    // TODO(dcramer): needs urlPrefix
    let query = jQuery.param({
      eventId: this.state.errorId,
      // TODO(dcramer): dsn should come from raven-js
      dsn: ConfigStore.get('dsn'),
    });
    return `/api/embed/error-page/?${query}`;
  },

  render() {
    // TODO(dcramer): show additional resource links
    return (
      <div className="alert alert-block alert-error">

        <div style={{fontSize: 24, marginBottom: 10}}>
          <span className="icon-exclamation" style={{fontSize: 20, marginRight: 10}} />
          <span>Oops! Something went wrong</span>
        </div>
        <p>It looks like you've hit an issue in our client appliation. Don't worry
          though! We use Sentry to monitor Sentry and it's likely we're already
          looking into this!</p>
        <p>If you're daring, you may want to try the following:</p>
        <ul>
          {window && window.adblockSuspected &&
            <li>We detected something AdBlock-like. Try disabling it, as it's known to cause issues.</li>
          }
          <li>Give it a few seconds and <a onClick={() => {
              window.location.href = window.location.href;
            }}>reload the page</a>.</li>
          <li>If all else fails, <a href="http://github.com/getsentry/sentry/issues">create an issue</a> with more details.</li>
        </ul>
      </div>
    );
  },
});

export default RouteError;

