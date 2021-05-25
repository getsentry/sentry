import * as React from 'react';
import ReactDOM from 'react-dom';
import * as Router from 'react-router';
import * as Sentry from '@sentry/react';
import createReactClass from 'create-react-class';
import jQuery from 'jquery';
import throttle from 'lodash/throttle';
import moment from 'moment';
import PropTypes from 'prop-types';
import Reflux from 'reflux';

import {Client} from 'app/api';
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
};

/**
 * Wrap export so that we can track usage of these globals to determine how we want to handle deprecatation.
 * These are sent to Sentry install, which then checks to see if SENTRY_BEACON is enabled
 * in order to make a request to the SaaS beacon.
 */
let _beaconComponents: {component: string; stack: string}[] = [];
const makeBeaconRequest = throttle(
  async () => {
    const api = new Client();

    const components = _beaconComponents;
    _beaconComponents = [];
    try {
      await api.requestPromise('/api/0/internal/beacon/', {
        method: 'POST',
        data: {
          // Limit to first 20 components... if there are more than 20, then something
          // is probably wrong.
          batch_data: components.slice(0, 20).map(component => ({
            description: 'SentryApp',
            ...component,
          })),
        },
      });
    } catch (e) {
      // Delicious failure.
    }
  },
  5000,
  {trailing: true, leading: false}
);

[
  [SentryApp, globals.SentryApp],
  [globals, window],
].forEach(([obj, parent]) => {
  const properties = Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      return [
        key,
        {
          configurable: false,
          enumerable: false,
          get() {
            try {
              const stack = new Error().stack;
              // Split stack by lines and filter out empty strings
              const stackArr = stack?.split('\n').filter(s => !!s) || [];
              // There's an issue with Firefox where this getter for jQuery gets called many times (> 100)
              // The stacktrace doesn't show it being called outside of this block either.
              // And this works fine in Chrome...
              if (key !== 'SentryApp' && stackArr.length > 1) {
                // Limit the number of frames to include
                _beaconComponents.push({
                  component: key,
                  stack: stackArr.slice(0, 5).join('\n'),
                });
                makeBeaconRequest();
              }
            } catch {
              // Ignore errors
            }

            return value;
          },
        },
      ];
    })
  );

  Object.defineProperties(parent, properties);
});

export default globals;
