import * as React from 'react';
import {findDOMNode, render} from 'react-dom';
// eslint-disable-next-line no-restricted-imports
import * as ReactRouter from 'react-router';
import * as Sentry from '@sentry/react';
import moment from 'moment';
import * as PropTypes from 'prop-types';
import * as Reflux from 'reflux';

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
  ReactDOM: {findDOMNode, render},

  // django templates make use of these globals
  SentryApp: {},
};

// The SentryApp global contains exported app modules for use in javascript
// modules that are not compiled with the sentry bundle.
const SentryApp = {
  // The following components are used in sentry-plugins.
  Form: require('sentry/components/deprecatedforms/form').TrackedDeprecatedForm,
  FormState: require('sentry/components/forms/state').default,
  LoadingIndicator: require('sentry/components/loadingIndicator').default,
  plugins: {
    add: plugins.add,
    addContext: plugins.addContext,
    BasePlugin: plugins.BasePlugin,
    DefaultIssuePlugin: plugins.DefaultIssuePlugin,
  },

  // The following components are used in legacy django HTML views
  // or in the Sentry sandbox
  ConfigStore: require('sentry/stores/configStore').default,
  HookStore: require('sentry/stores/hookStore').default,
  GuideActionCreator: require('sentry/actionCreators/guides'),
  Modal: require('sentry/actionCreators/modal'),
  getModalPortal: require('sentry/utils/getModalPortal').default,
  Client: require('sentry/api').Client,
  IconArrow: require('sentry/icons/iconArrow').IconArrow,
  IconClose: require('sentry/icons/iconClose').IconClose,
  IconCheckmark: require('sentry/icons/iconCheckmark').IconCheckmark,
};

globals.SentryApp = SentryApp;
Object.keys(globals).forEach(name => (window[name] = globals[name]));

export default globals;
