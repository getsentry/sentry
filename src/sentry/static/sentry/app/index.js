import jQuery from 'jquery';

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
    api: require('./api'),
    routes: require('./routes'),
    plugins: {
      add: plugins.add,
      BasePlugin: plugins.BasePlugin,
      DefaultIssuePlugin: plugins.DefaultIssuePlugin
    },

    Alerts: require('./components/alerts'),
    AlertActions: require('./actions/alertActions'),
    AvatarSettings: require('./components/avatarSettings'),
    mixins: {
      ApiMixin: require('./mixins/apiMixin'),
      TooltipMixin: require('./mixins/tooltip')
    },
    BarChart: require('./components/barChart'),
    i18n: require('./locale'),
    ConfigStore: require('./stores/configStore'),
    Count: require('./components/count'),
    DateTime: require('./components/dateTime'),
    DropdownLink: require('./components/dropdownLink'),
    FlotChart: require('./components/flotChart'),
    Form: require('./components/forms/form'),
    FormState: require('./components/forms/index').FormState,
    HookStore: require('./stores/hookStore'),
    Indicators: require('./components/indicators'),
    IndicatorStore: require('./stores/indicatorStore'),
    LoadingError: require('./components/loadingError'),
    LoadingIndicator: require('./components/loadingIndicator'),
    ListLink: require('./components/listLink'),
    MenuItem: require('./components/menuItem'),
    OrganizationHomeContainer: require('./components/organizations/homeContainer'),
    OrganizationsLoader: require('./components/organizations/organizationsLoader'),
    Pagination: require('./components/pagination'),
    PluginConfig: require('./components/pluginConfig'),
    ProjectIssueTracking: require('./views/projectIssueTracking'),
    ProjectSelector: require('./components/projectHeader/projectSelector'),
    RuleEditor: require('./views/ruleEditor'),
    Sidebar: require('./components/sidebar'),
    StackedBarChart: require('./components/stackedBarChart'),
    TimeSince: require('./components/timeSince'),
    TodoList: require('./components/todos'),
    U2fEnrollment: require('./components/u2fenrollment'),
    U2fSign: require('./components/u2fsign'),
    utils: {
      errorHandler: require('./utils/errorHandler')
    }
  }
};
