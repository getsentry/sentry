import jQuery from 'jquery';

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
      xhr.setRequestHeader('X-CSRFToken', getCookie('csrf'));
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
  Router: require('react-router'),

  Sentry: {
    api: require('./api'),
    routes: require('./routes'),
    createHistory: require('history/lib/createBrowserHistory'),
    Alerts: require('./components/alerts'),
    mixins: {
      ApiMixin: require('./mixins/apiMixin'),
    },
    BarChart: require('./components/barChart'),
    i18n: require('./locale'),
    ConfigStore: require('./stores/configStore'),
    DropdownLink: require('./components/dropdownLink'),
    FlotChart: require('./components/flotChart'),
    HookStore: require('./stores/hookStore'),
    Indicators: require('./components/indicators'),
    LoadingError: require('./components/loadingError'),
    LoadingIndicator: require('./components/loadingIndicator'),
    ListLink: require('./components/listLink'),
    MenuItem: require('./components/menuItem'),
    Pagination: require('./components/pagination'),
    ProjectSelector: require('./components/projectHeader/projectSelector'),
    RuleEditor: require('./views/ruleEditor'),
    TimeSince: require('./components/timeSince'),
    TodoList: require('./components/todos')
  }
};
