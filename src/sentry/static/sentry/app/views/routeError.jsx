import jQuery from 'jquery';
import Raven from 'raven-js';
import React from 'react';

import ConfigStore from '../stores/configStore';
import {t} from '../locale';


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
    Raven.captureException(this.props.err);
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
        <span className="icon-exclamation" style={{marginRight: 10}}/>
        {t('There was an unexpected error rendering this page.')}
      </div>
    );
  },
});

export default RouteError;

