import * as React from 'react';
import {createRoot} from 'react-dom/client';
import * as Sentry from '@sentry/react';
import moment from 'moment-timezone';

const globals: Record<string, any> = {
  React,
  Sentry,
  moment,
  ReactDOM: {createRoot},

  // django templates make use of these globals
  SentryApp: {},
};

// The SentryApp global contains exported app modules for use in javascript
// modules that are not compiled with the sentry bundle.
const SentryApp = {
  // The following components are used in legacy django HTML views
  // or in the Sentry sandbox
  FormState: require('sentry/components/forms/state').default,
  LoadingIndicator: require('sentry/components/loadingIndicator').default,
  ConfigStore: require('sentry/stores/configStore').default,
  GuideActionCreator: require('sentry/actionCreators/guides'),
  Modal: require('sentry/actionCreators/modal'),
  getModalPortal: require('sentry/utils/getModalPortal').default,
  Client: require('sentry/api').Client,
  // This is used in the Email Modal in the Sandbox
  IconArrow: require('sentry/icons/iconArrow').IconArrow,
};

globals.SentryApp = SentryApp;
Object.keys(globals).forEach(name => {
  Object.defineProperty(window, name, {
    value: globals[name],
    writable: true,
  });
});

export {globals as exportedGlobals};
