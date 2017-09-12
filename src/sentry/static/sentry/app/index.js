import jQuery from 'jquery';
import moment from 'moment';
import Raven from 'raven-js';
import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import {renderToStaticMarkup} from 'react-dom/server';
import Reflux from 'reflux';
import * as Router from 'react-router';
import ReactBootstrapModal from 'react-bootstrap/lib/Modal';

import * as api from './api';
import * as il8n from './locale';
import plugins from './plugins';

const csrfCookieName = window.csrfCookieName || 'sc';

// setup jquery for CSRF tokens
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    let cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      let cookie = jQuery.trim(cookies[i]);
      // Does this cookie string begin with the name we want?
      if (cookie.substring(0, name.length + 1) == name + '=') {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

function csrfSafeMethod(method) {
  // these HTTP methods do not require CSRF protection
  return /^(GET|HEAD|OPTIONS|TRACE)$/.test(method);
}

jQuery.ajaxSetup({
  beforeSend: function(xhr, settings) {
    if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
      xhr.setRequestHeader('X-CSRFToken', getCookie(csrfCookieName));
    }
  }
});

// these get exported to a global variable, which is important as its the only
// way we can call into scoped objects

export default {
  jQuery,
  moment,
  Raven,
  React,
  ReactDOM: {
    findDOMNode: ReactDOM.findDOMNode,
    render: ReactDOM.render
  },
  PropTypes,
  ReactDOMServer: {
    renderToStaticMarkup
  },
  ReactBootstrap: {
    Modal: ReactBootstrapModal
  },
  Reflux,
  Router,

  Sentry: {
    api,
    routes: require('./routes').default,
    forms: {
      // we dont yet export all form field classes as they're not
      // all needed by sentry.io
      BooleanField: require('./components/forms/booleanField').default,
      EmailField: require('./components/forms/emailField').default,
      RangeField: require('./components/forms/rangeField').default,
      Select2Field: require('./components/forms/select2Field').default,
      TextField: require('./components/forms/textField').default,
      TextareaField: require('./components/forms/textareaField').default
    },
    plugins: {
      add: plugins.add,
      addContext: plugins.addContext,
      BasePlugin: plugins.BasePlugin,
      DefaultIssuePlugin: plugins.DefaultIssuePlugin
    },

    Alerts: require('./components/alerts').default,
    AlertActions: require('./actions/alertActions').default,
    AvatarSettings: require('./components/avatarSettings').default,
    mixins: {
      ApiMixin: require('./mixins/apiMixin').default,
      TooltipMixin: require('./mixins/tooltip').default
    },
    BarChart: require('./components/barChart').default,
    i18n: il8n,
    ConfigStore: require('./stores/configStore').default,
    Count: require('./components/count').default,
    DateTime: require('./components/dateTime').default,
    DropdownLink: require('./components/dropdownLink').default,
    Form: require('./components/forms/form').default,
    FormState: require('./components/forms/index').FormState,
    HookStore: require('./stores/hookStore').default,
    Indicators: require('./components/indicators').default,
    IndicatorStore: require('./stores/indicatorStore').default,
    LoadingError: require('./components/loadingError').default,
    LoadingIndicator: require('./components/loadingIndicator').default,
    ListLink: require('./components/listLink').default,
    MenuItem: require('./components/menuItem').default,
    OrganizationHomeContainer: require('./components/organizations/homeContainer')
      .default,
    OrganizationsLoader: require('./components/organizations/organizationsLoader')
      .default,
    Pagination: require('./components/pagination').default,
    PluginConfig: require('./components/pluginConfig').default,
    ProjectIssueTracking: require('./views/projectIssueTracking').default,
    ProjectSelector: require('./components/projectHeader/projectSelector').default,
    RuleEditor: require('./views/ruleEditor').default,
    Sidebar: require('./components/sidebar').default,
    StackedBarChart: require('./components/stackedBarChart').default,
    TimeSince: require('./components/timeSince').default,
    TodoList: require('./components/onboardingWizard/todos').default,
    U2fEnrollment: require('./components/u2fenrollment').default,
    U2fSign: require('./components/u2fsign').default,
    Badge: require('./components/badge').default,
    Switch: require('./components/switch').default,
    NumberConfirm: require('./components/confirms/numberConfirm').default,
    utils: {
      errorHandler: require('./utils/errorHandler').default,
      logging: require('./utils/logging')
    }
  }
};
