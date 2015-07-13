(function(window, document, JSON){
  'use strict';

  var GENERIC_ERROR = '<p class="message-error">An unknown error occurred while submitting your report. Please try again.</p>';
  var FORM_ERROR = '<p class="message-error">Some fields were invalid. Please correct the errors and try again.</p>';

  var template = {{ template }};
  var endpoint = {{ endpoint }};
  var options = window.sentryConfig;
  var encode = window.encodeURIComponent;

  var escape = function(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  };

  var serialize = function(form) {
    var q = [];
    for (var i = 0; i < form.elements.length; i++) {
      q.push(form.elements[i].name + "=" + encodeURIComponent(form.elements[i].value));
    }
    return q.join("&");
  };

  var onReady = function(f) {
    /in/.test(document.readyState)
      ? setTimeout(function() { onReady(f); }, 9)
      : f();
  };

  var close = function() {
    document.body.removeChild(child);
  };

  var submit = function(body) {
    var xhr;
    if (window.XMLHttpRequest) {
      // code for IE7+, Firefox, Chrome, Opera, Safari
      xhr = new XMLHttpRequest();
    } else {
      // code for IE6, IE5
      xhr = new ActiveXObject("Microsoft.XMLHTTP");
    }

    xhr.onreadystatechange = function() {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status === 200) {
          formContent.innerHTML = '<p class="message-success">Your report has been sent. Thank you!</p>';
          submitBtn.parentNode.removeChild(submitBtn);
        } else if (xhr.status == 400) {
          var data = JSON.parse(xhr.responseText);
          var node;
          for (var key in formMap) {
            node = formMap[key]
            if (data.errors[key]) {
              if (!/form-errors/.test(node.className)) {
                node.className += " form-errors";
              }
            } else if (/form-errors/.test(node.className)) {
              node.className = node.className.replace(/form-errors/, "");
            }
          }
          errorWrapper.innerHTML = FORM_ERROR;
        } else {
          errorWrapper.innerHTML = GENERIC_ERROR;
        }
      }
    }
    xhr.open("POST", endpoint, true);
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    xhr.send(body);
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
    submit(serialize(form));
  };

  var submitBtn = child.getElementsByTagName('button')[0]
  submitBtn.onclick = function(e) {
    e.preventDefault();
    submit(serialize(form));
  };

  var errorWrapper;
  var formContent;
  var divTags = form.getElementsByTagName('div');
  for (var i = 0; i < divTags.length; i++) {
    if (divTags[i].className === 'error-wrapper') {
      errorWrapper = divTags[i];
    }
    if (divTags[i].className === 'form-content') {
      formContent = divTags[i];
    }
  }

  var linkTags = child.getElementsByTagName('a');
  for (var i = 0; i < linkTags.length; i++) {
    if (linkTags[i].className === 'close') {
      linkTags[i].onclick = function(e) {
        e.preventDefault();
        close();
      }
    }
  }

  var formMap = {};
  for (var i = 0; i < form.elements.length; i++) {
    formMap[form.elements[i].name] = form.elements[i].parentNode;
  }

  onReady(function(){
    document.body.appendChild(child);
  });
}(window, document, JSON));
