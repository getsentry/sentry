(function(window, document){
  'use strict';

  var template = {{ template }};
  var endpoint = {{ endpoint }};
  var options = window.sentryConfig;

  var onReady = function(f) {
    /in/.test(document.readyState)
      ? setTimeout(function() { onReady(f); }, 9)
      : f();
  };

  onReady(function(){
    var child = document.createElement('div');
    child.className = 'sentry-error-embed-wrapper';
    child.innerHTML = template;
    child.onclick = function(e){
      if (e.target !== child) return;
      document.body.removeChild(child);
    };
    var form = child.getElementsByTagName('form')[0];
    form.onsubmit = function(e) {
      e.preventDefault();
    };
    document.body.appendChild(child);
  });
}(window, document));
