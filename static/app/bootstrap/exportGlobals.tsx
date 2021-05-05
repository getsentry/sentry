import * as React from 'react';
import ReactDOM from 'react-dom';
import * as Router from 'react-router';
import * as Sentry from '@sentry/react';
import createReactClass from 'create-react-class';
import jQuery from 'jquery';
import moment from 'moment';
import PropTypes from 'prop-types';
import Reflux from 'reflux';

import plugins from 'app/plugins';

// The password strength component is very heavyweight as it includes the
// zxcvbn, a relatively byte-heavy password strength estimation library. Load
// it on demand.
async function loadPasswordStrength(callback: Function) {
  try {
    const module = await import(
      /* webpackChunkName: "passwordStrength" */ 'app/components/passwordStrength'
    );
    callback(module);
  } catch (err) {
    // Ignore if client can't load this, it enhances UX a bit, but is optional
  }
}

const globals = {
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
  SentryApp: {},
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
  SystemAlerts: require('app/views/app/systemAlerts').default,
  Indicators: require('app/components/indicators').default,
  SetupWizard: require('app/components/setupWizard').default,
  HookStore: require('app/stores/hookStore').default,
  Modal: require('app/actionCreators/modal'),
};

// Make globals available on the window object
Object.keys(globals).forEach(name => (window[name] = globals[name]));
