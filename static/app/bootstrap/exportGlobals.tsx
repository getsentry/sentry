import * as React from 'react';
import ReactDOM from 'react-dom';
import * as ReactRouter from 'react-router';
import * as Sentry from '@sentry/react';
import moment from 'moment';
import PropTypes from 'prop-types';
import Reflux from 'reflux';

import plugins from 'sentry/plugins';

const globals = {
  // The following globals are used in sentry-plugins webpack externals
  // configuration.
  PropTypes,
  React,
  Reflux,
  Sentry,
  moment,
  Router: ReactRouter,
  ReactDOM: {
    findDOMNode: ReactDOM.findDOMNode,
    render: ReactDOM.render,
  },

  // django templates make use of these globals
  SentryApp: {},
};

// The SentryApp global contains exported app modules for use in javascript
// modules that are not compiled with the sentry bundle.
const SentryApp = {
  // The following components are used in sentry-plugins.
  Form: require('sentry/components/deprecatedforms/form').default,
  FormState: require('sentry/components/forms/state').default,
  LoadingIndicator: require('sentry/components/loadingIndicator').default,
  plugins: {
    add: plugins.add,
    addContext: plugins.addContext,
    BasePlugin: plugins.BasePlugin,
    DefaultIssuePlugin: plugins.DefaultIssuePlugin,
  },

  // The following components are used in legacy django HTML views
  ConfigStore: require('sentry/stores/configStore').default,
  HookStore: require('sentry/stores/hookStore').default,
  Modal: require('sentry/actionCreators/modal'),
  getModalPortal: require('sentry/utils/getModalPortal').default,
  Client: require('sentry/api').Client,
};

globals.SentryApp = SentryApp;
Object.keys(globals).forEach(name => (window[name] = globals[name]));

export default globals;
