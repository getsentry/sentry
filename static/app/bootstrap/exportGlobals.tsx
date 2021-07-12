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
const SentryApp = {
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
  ConfigStore: require('app/stores/configStore').default,
  HookStore: require('app/stores/hookStore').default,
  Modal: require('app/actionCreators/modal'),
  getModalPortal: require('app/utils/getModalPortal').default,
};

globals.SentryApp = SentryApp;
Object.keys(globals).forEach(name => (window[name] = globals[name]));

export default globals;
