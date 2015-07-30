var jQuery = require("jquery");

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

function sameOrigin(url) {
  // url could be relative or scheme relative or absolute
  var host = document.location.host; // host + port
  var protocol = document.location.protocol;
  var sr_origin = '//' + host;
  var origin = protocol + sr_origin;
  // Allow absolute or scheme relative URLs to same origin
  return (url == origin || url.slice(0, origin.length + 1) == origin + '/') ||
      (url == sr_origin || url.slice(0, sr_origin.length + 1) == sr_origin + '/') ||
      // or any other URL that isn't scheme relative or absolute i.e relative.
      !(/^(\/\/|http:|https:).*/.test(url));
}

function safeMethod(method) {
  return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}

jQuery(document).ajaxSend(function(event, xhr, settings) {
  if (!safeMethod(settings.type) && sameOrigin(settings.url)) {
    xhr.setRequestHeader("X-CSRFToken", getCookie('csrftoken'));
  }
});

// these get exported to a global variable, which is important as its the only
// way we can call into scoped objects
module.exports = {
  jQuery: jQuery,
  moment: require("moment"),
  Raven: require("raven-js"),
  React: require("react"),
  Router: require("react-router"),

  Sentry: {
    routes: require("./routes"),

    Alerts: require("./components/alerts"),
    ConfigStore: require("./stores/configStore"),
    FlotChart: require("./components/flotChart"),
    HookStore: require("./stores/hookStore"),
    Indicators: require("./components/indicators"),
    RuleEditor: require("./views/ruleEditor")
  }
};
