import * as React from 'react';
import {createRoot} from 'react-dom/client';
import * as Sentry from '@sentry/react';
import moment from 'moment-timezone';

import * as GuideActionCreator from 'sentry/actionCreators/guides';
import * as Modal from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import FormState from 'sentry/components/forms/state';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconArrow} from 'sentry/icons/iconArrow';
import plugins from 'sentry/plugins';
import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import getModalPortal from 'sentry/utils/getModalPortal';

const globals: Record<string, any> = {
  // The following globals are used in sentry-plugins webpack externals
  // configuration.
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
  // The following components are used in sentry-plugins.
  FormState,
  LoadingIndicator,
  plugins: {
    add: plugins.add,
    addContext: plugins.addContext,
    BasePlugin: plugins.BasePlugin,
    DefaultIssuePlugin: plugins.DefaultIssuePlugin,
  },

  // The following components are used in legacy django HTML views
  // or in the Sentry sandbox
  ConfigStore,
  HookStore,
  GuideActionCreator,
  Modal,
  getModalPortal,
  Client,
  // This is used in the Email Modal in the Sandbox
  IconArrow,
};

globals.SentryApp = SentryApp;
Object.keys(globals).forEach(name => {
  Object.defineProperty(window, name, {
    value: globals[name],
    writable: true,
  });
});

export {globals as exportedGlobals};
