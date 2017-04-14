import jQuery from 'jquery';

import plugins from './plugins';
import cookies from './utils/cookies';

const csrfCookieName = window.csrfCookieName || 'sc';

function csrfSafeMethod(method) {
  // these HTTP methods do not require CSRF protection
  return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}

jQuery.ajaxSetup({
  beforeSend: function(xhr, settings) {
    if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
      xhr.setRequestHeader('X-CSRFToken', cookies.get(csrfCookieName));
    }
  }
});

// these get exported to a global variable, which is important as its the only
// way we can call into scoped objects

import moment from 'moment';
import Raven from 'raven-js';
import React from 'react';
import ReactDOM from 'react-dom';
import Reflux from 'reflux';
import * as Router from 'react-router';
import underscore from 'underscore';
import ReactBootstrapModal from 'react-bootstrap/lib/Modal';

import * as api from './api';
import * as il8n from './locale';

export default {
  jQuery: jQuery,
  moment: moment,
  Raven: Raven,
  React: React,
  ReactDOM: ReactDOM,
  ReactBootstrap: {
    Modal: ReactBootstrapModal
  },
  Reflux: Reflux,
  Router: Router,
  underscore: underscore,

  Sentry: {
    api: api,
    routes: require('./routes').default,
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
    FlotChart: require('./components/flotChart').default,
    Form: require('./components/forms/form').default,
    FormState: require('./components/forms/index').FormState,
    HookStore: require('./stores/hookStore').default,
    Indicators: require('./components/indicators').default,
    IndicatorStore: require('./stores/indicatorStore').default,
    LoadingError: require('./components/loadingError').default,
    LoadingIndicator: require('./components/loadingIndicator').default,
    ListLink: require('./components/listLink').default,
    MenuItem: require('./components/menuItem').default,
    OrganizationHomeContainer: require('./components/organizations/homeContainer').default,
    OrganizationsLoader: require('./components/organizations/organizationsLoader').default,
    Pagination: require('./components/pagination').default,
    PluginConfig: require('./components/pluginConfig').default,
    ProjectIssueTracking: require('./views/projectIssueTracking').default,
    ProjectSelector: require('./components/projectHeader/projectSelector').default,
    RuleEditor: require('./views/ruleEditor').default,
    Sidebar: require('./components/sidebar').default,
    StackedBarChart: require('./components/stackedBarChart').default,
    TimeSince: require('./components/timeSince').default,
    TodoList: require('./components/todos').default,
    U2fEnrollment: require('./components/u2fenrollment').default,
    U2fSign: require('./components/u2fsign').default,
    Badge: require('./components/badge').default,
    Switch: require('./components/switch').default,
    NumberConfirm: require('./components/confirms/numberConfirm').default,
    utils: {
      errorHandler: require('./utils/errorHandler').default,
      logging: require('./utils/logging'),
    }
  }
};
