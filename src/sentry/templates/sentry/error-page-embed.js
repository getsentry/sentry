(function(window, document, JSON){
  'use strict';
  // TODO(dcramer): expose API for building a new error embed so things like
  // JS applications can render this on demand
  /**
    window.sentryConfig = {
      dsn: 'http://public@example.com/1',
      eventId: '...',
      attachOnLoad: true,
      parent: document.body
    };
   */

  var GENERIC_ERROR = '<p class="message-error">An unknown error occurred while submitting your report. Please try again.</p>';
  var FORM_ERROR = '<p class="message-error">Some fields were invalid. Please correct the errors and try again.</p>';

  // XMLHttpRequest.DONE does not exist in all browsers
  var XHR_DONE = 4;

  var template = {{ template }};
  var endpoint = {{ endpoint }};
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

  var SentryErrorEmbed = function(options) {
    this.build();
  };

  SentryErrorEmbed.prototype.build = function() {
    var self = this;
    this.element = document.createElement('div');
    this.element.className = 'sentry-error-embed-wrapper';
    this.element.innerHTML = template;
    self.element.onclick = function(e){
      if (e.target !== self.element) return;
      self.close();
    };

    this._form = this.element.getElementsByTagName('form')[0];
    this._form.onsumbit = function(e) {
      e.preventDefault();
      self.submit(self.serialize());
    };

    this._submitBtn = this.element.getElementsByTagName('button')[0]
    this._submitBtn.onclick = function(e) {
      e.preventDefault();
      self.submit(self.serialize());
    };

    var divTags = this._form.getElementsByTagName('div');
    for (var i = 0; i < divTags.length; i++) {
      if (divTags[i].className === 'error-wrapper') {
        this._errorWrapper = divTags[i];
      }
      if (divTags[i].className === 'form-content') {
        this._formContent = divTags[i];
      }
    }

    var linkTags = this.element.getElementsByTagName('a');
    for (var i = 0; i < linkTags.length; i++) {
      if (linkTags[i].className === 'close') {
        linkTags[i].onclick = function(e) {
          e.preventDefault();
          self.close();
        };
      }
    }

    this._formMap = {};
    var node;
    for (var i = 0; i < this._form.elements.length; i++) {
      node = this._form.elements[i];
      this._formMap[node.name] = node.parentNode;
    }
  };

  SentryErrorEmbed.prototype.serialize = function() {
    return serialize(this._form);
  };

  SentryErrorEmbed.prototype.close = function() {
    this.element.parentNode.removeChild(this.element);
  };

  SentryErrorEmbed.prototype.submit = function(body) {
    var self = this;
    if (this._submitInProgress)
      return;
    this._submitInProgress = true;

    var xhr new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState === XHR_DONE) {
        if (xhr.status === 200) {
          self._errorWrapper.innerHTML = '';
          self._formContent.innerHTML = '<p class="message-success">Your feedback has been sent. Thank you!</p>';
          self._submitBtn.parentNode.removeChild(self._submitBtn);
        } else if (xhr.status == 400) {
          var data = JSON.parse(xhr.responseText);
          var node;
          for (var key in self._formMap) {
            node = self._formMap[key]
            if (data.errors[key]) {
              if (!/form-errors/.test(node.className)) {
                node.className += " form-errors";
              }
            } else if (/form-errors/.test(node.className)) {
              node.className = node.className.replace(/form-errors/, "");
            }
          }
          self._errorWrapper.innerHTML = FORM_ERROR;
        } else {
          self._errorWrapper.innerHTML = GENERIC_ERROR;
        }
        self._submitInProgress = false;
      }
    };
    xhr.open("POST", endpoint, true);
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    xhr.send(body);
  };

  SentryErrorEmbed.prototype.attach = function(parent) {
    parent.appendChild(this.element);
  };

  var options = window.sentryConfig || {};
  var embed = new SentryErrorEmbed(options);
  if (options.attachOnLoad !== false) {
    onReady(function(){
      embed.attach(options.parent || document.body);
    });
  }
}(window, document, JSON));
