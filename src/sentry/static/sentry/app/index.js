/* global module */
import moment from 'moment';
import Raven from 'raven-js';
import React from 'react';
import ReactDOM from 'react-dom';
import {renderToStaticMarkup} from 'react-dom/server';
import * as Router from 'react-router';
import Reflux from 'reflux';
import ReactBootstrapModal from 'react-bootstrap/lib/Modal';

import 'select2';

import Sentry from './shared';

let render = () => {
  let rootEl = document.getElementById('blk_router');
  const AppRoot = require('./views/appRoot').default;
  ReactDOM.render(React.createElement(AppRoot), rootEl);
};

export default {
  jQuery,
  moment,
  Raven,
  React,
  ReactDOM: {
    findDOMNode: ReactDOM.findDOMNode,
    render: ReactDOM.render
  },
  ReactDOMServer: {
    renderToStaticMarkup: renderToStaticMarkup
  },
  ReactBootstrap: {
    Modal: ReactBootstrapModal
  },
  SentryRenderApp: render,
  Reflux,
  Router,
  Sentry
};
