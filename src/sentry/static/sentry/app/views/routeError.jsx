import $ from 'jquery';
import Raven from 'raven-js';
import React from 'react';

const RouteError = React.createClass({
  propTypes: {
    error: React.PropTypes.object.isRequired
  },

  componentWillMount() {
    // TODO(dcramer): show something in addition to embed (that contains it?)
    // TODO(dcramer): capture better context
    // throw this in a timeout so if it errors we dont fall over
    this._timeout = window.setTimeout(function(){
      Raven.captureException(this.props.error);
      // TODO(dcramer): we do not have errorId until send() is called which
      // has latency in production so this will literally never fire
      Raven.showReportDialog();
    }.bind(this));
  },

  componentWillUnmount() {
    if (this._timeout) {
      window.clearTimeout(this._timeout);
    }
    $('.sentry-error-embed-wrapper').remove();
  },

  render() {
    // TODO(dcramer): show additional resource links
    return (
      <div className="alert alert-block alert-error">

        <div style={{fontSize: 24, marginBottom: 10}}>
          <span className="icon-exclamation" style={{fontSize: 20, marginRight: 10}} />
          <span>Oops! Something went wrong</span>
        </div>
        <p>It looks like you've hit an issue in our client application. Don't worry
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

