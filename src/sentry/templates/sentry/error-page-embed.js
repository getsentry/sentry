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

  var close = function() {
    document.body.removeChild(child);
  };

  var child = document.createElement('div');
  child.className = 'sentry-error-embed-wrapper';
  child.innerHTML = template;
  child.onclick = function(e){
    if (e.target !== child) return;
    close();
  };
  var form = child.getElementsByTagName('form')[0];
  form.onsumbit = function(e) {
    e.preventDefault();
  };
  var linkTags = child.getElementsByTagName('a');
  for (var i = 0; i < linkTags.length; i++) {
    if (linkTags[i].className === 'close') {
      linkTags[i].onclick = function(e) {
        e.preventDefault();
        close();
      }
    }
  }

  onReady(function(){
    document.body.appendChild(child);
  });
}(window, document));
