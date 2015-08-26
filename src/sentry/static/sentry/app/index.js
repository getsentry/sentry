import jQuery from "jquery";

// setup jquery for CSRF tokens
function getCookie(name) {
  var cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
      var cookie = jQuery.trim(cookies[i]);
      // Does this cookie string begin with the name we want?
      if (cookie.substring(0, name.length + 1) == (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

csrftoken = getCookie("csrf");

function csrfSafeMethod(method) {
  // these HTTP methods do not require CSRF protection
  return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}
jQuery.ajaxSetup({
  beforeSend: function(xhr, settings) {
    if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
      xhr.setRequestHeader("X-CSRFToken", csrftoken);
    }
  }
});

// these get exported to a global variable, which is important as its the only
// way we can call into scoped objects
export default {
  jQuery: jQuery,
  moment: require("moment"),
  Raven: require("raven-js"),
  React: require("react"),
  Router: require("react-router"),

  Sentry: {
    api: require("./api"),
    routes: require("./routes"),

    Alerts: require("./components/alerts"),
    ConfigStore: require("./stores/configStore"),
    FlotChart: require("./components/flotChart"),
    HookStore: require("./stores/hookStore"),
    Indicators: require("./components/indicators"),
    RuleEditor: require("./views/ruleEditor")
  }
};





