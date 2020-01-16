import 'bootstrap/js/alert';
import 'bootstrap/js/tab';
import 'bootstrap/js/dropdown';
import 'focus-visible';

import 'app/utils/statics-setup';
import 'app/utils/emotion-setup';

import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import Reflux from 'reflux';
import * as Router from 'react-router';
import * as Sentry from '@sentry/browser';
import {ExtraErrorData} from '@sentry/integrations';
import {Integrations} from '@sentry/apm';
import createReactClass from 'create-react-class';
import jQuery from 'jquery';
import moment from 'moment';

import {metric} from 'app/utils/analytics';
import ConfigStore from 'app/stores/configStore';
import Main from 'app/main';
import ajaxCsrfSetup from 'app/utils/ajaxCsrfSetup';
import plugins from 'app/plugins';

// App setup
if (window.__initialData) {
  ConfigStore.loadInitialData(window.__initialData);
}

// SDK INIT  --------------------------------------------------------
const config = ConfigStore.getConfig();
// Only enable self-tracing when isApmDataSamplingEnabled is true
const tracesSampleRate = config ? config.apmSampling : 0;
Sentry.init({
  ...window.__SENTRY__OPTIONS,
  integrations: [
    new ExtraErrorData({
      // 6 is arbitrary, seems like a nice number
      depth: 6,
    }),
    new Integrations.Tracing({
      tracingOrigins: ['localhost', 'sentry.io', /^\//],
      tracesSampleRate,
    }),
  ],
});

if (window.__SENTRY__USER) {
  Sentry.setUser(window.__SENTRY__USER);
}
if (window.__SENTRY__VERSION) {
  Sentry.setTag('sentry_version', window.__SENTRY__VERSION);
}

// Used for operational metrics to determine that the application js
// bundle was loaded by browser.
metric.mark('sentry-app-init');

// setup jquery for CSRF tokens
jQuery.ajaxSetup({
  //jQuery won't allow using the ajaxCsrfSetup function directly
  beforeSend: ajaxCsrfSetup,
});

const render = Component => {
  const rootEl = document.getElementById('blk_router');

  try {
    ReactDOM.render(<Component />, rootEl);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      new Error(
        'An unencoded "%" has appeared, it is super effective! (See https://github.com/ReactTraining/history/issues/505)'
      )
    );
    if (err.message === 'URI malformed') {
      window.location.assign(window.location.pathname);
    }
  }
};

// The password strength component is very heavyweight as it includes the
// zxcvbn, a relatively byte-heavy password strength estimation library. Load
// it on demand.
async function loadPasswordStrength(callback) {
  const module = await import(/* webpackChunkName: "passwordStrength" */ 'app/components/passwordStrength');
  callback(module);
}

const globals = {
  // This is the primary entrypoint for rendering the sentry app.
  SentryRenderApp: () => render(Main),

  // The following globals are used in sentry-plugins webpack externals
  // configuration.
  PropTypes,
  React,
  Reflux,
  Router,
  Sentry,
  moment,
  ReactDOM: {
    findDOMNode: ReactDOM.findDOMNode,
    render: ReactDOM.render,
  },

  // jQuery is still exported to the window as some bootsrap functionality
  // and legacy plugins like youtrack make use of it.
  $: jQuery,
  jQuery,

  // django templates make use of these globals
  createReactClass,
};

// The SentryApp global contains exported app modules for use in javascript
// modules that are not compiled with the sentry bundle.
globals.SentryApp = {
  // The following components are used in sentry-plugins.
  Form: require('app/components/forms/form').default,
  FormState: require('app/components/forms/index').FormState,
  LoadingIndicator: require('app/components/loadingIndicator').default,
  plugins: {
    add: plugins.add,
    addContext: plugins.addContext,
    BasePlugin: plugins.BasePlugin,
    DefaultIssuePlugin: plugins.DefaultIssuePlugin,
  },

  // The following components are used in legacy django HTML views
  passwordStrength: {load: loadPasswordStrength},
  U2fSign: require('app/components/u2f/u2fsign').default,
  ConfigStore: require('app/stores/configStore').default,
  Alerts: require('app/components/alerts').default,
  Indicators: require('app/components/indicators').default,
  SetupWizard: require('app/components/setupWizard').default,
};

// Make globals available on the window object
Object.keys(globals).forEach(name => (window[name] = globals[name]));

export default globals;
