import jQuery from 'jquery';

import plugins from '../app/plugins';

const csrfCookieName = window.csrfCookieName || 'sc';

// setup jquery for CSRF tokens
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    let cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      let cookie = jQuery.trim(cookies[i]);
      // Does this cookie string begin with the name we want?
      if (cookie.substring(0, name.length + 1) == (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

function csrfSafeMethod(method) {
  // these HTTP methods do not require CSRF protection
  return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
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
  jQuery: jQuery,
  moment: require('moment'),
  Raven: require('raven-js'),
  React: require('react'),
  ReactDOM: require('react-dom'),
  Reflux: require('reflux'),
  Router: require('react-router'),
  underscore: require('underscore'),

  Sentry: {
    api: require('../app/api'),
    routes: require('../app/routes'),
    plugins: {
      add: plugins.add,
      BasePlugin: plugins.BasePlugin,
      DefaultIssuePlugin: plugins.DefaultIssuePlugin
    },

    createHistory: require('history/lib/createBrowserHistory'),
    Alerts: require('../app/components/alerts'),
    AlertActions: require('../app/actions/alertActions'),
    AvatarSettings: require('../app/components/avatarSettings'),
    mixins: {
      ApiMixin: require('../app/mixins/apiMixin'),
      TooltipMixin: require('./mixins/tooltip')
    },
    BarChart: require('../app/components/barChart'),
    i18n: require('../app/locale'),
    ConfigStore: require('../app/stores/configStore'),
    Count: require('../app/components/count'),
    DateTime: require('../app/components/dateTime'),
    DropdownLink: require('../app/components/dropdownLink'),
    FlotChart: require('../app/components/flotChart'),
    Form: require('../app/components/forms/form'),
    FormState: require('../app/components/forms/index').FormState,
    HookStore: require('../app/stores/hookStore'),
    Indicators: require('../app/components/indicators'),
    IndicatorStore: require('../app/stores/indicatorStore'),
    LoadingError: require('../app/components/loadingError'),
    LoadingIndicator: require('../app/components/loadingIndicator'),
    ListLink: require('../app/components/listLink'),
    MenuItem: require('../app/components/menuItem'),
    OrganizationHomeContainer: require('../app/components/organizations/homeContainer'),
    OrganizationsLoader: require('../app/components/organizations/organizationsLoader'),
    Pagination: require('../app/components/pagination'),
    PluginConfig: require('../app/components/pluginConfig'),
    ProjectIssueTracking: require('../app/views/projectIssueTracking'),
    ProjectSelector: require('../app/components/projectHeader/projectSelector'),
    RuleEditor: require('../app/views/ruleEditor'),
    Sidebar: require('../app/components/sidebar'),
    StackedBarChart: require('../app/components/stackedBarChart'),
    TimeSince: require('../app/components/timeSince'),
    TodoList: require('../app/components/todos'),
    U2fEnrollment: require('../app/components/u2fenrollment'),
    U2fSign: require('../app/components/u2fsign'),
    utils: {
      errorHandler: require('../app/utils/errorHandler')
    }
  }
};
