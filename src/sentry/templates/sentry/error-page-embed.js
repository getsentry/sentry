/*eslint no-var:0,strict:0,block-scoped-var:0*/
/*global sentryEmbedCallback:false*/
(function (window, document, JSON) {
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

  var strings = /*{{ strings }}*/ '';
  var template = /*{{ template }}*/ '';
  var endpoint = /*{{ endpoint }}*/ '';

  var setChild = function (target, child) {
    target.innerHTML = '';
    target.appendChild(child);
  };

  var buildMessage = function (className, message) {
    var p = document.createElement('p');
    p.className = className;
    p.appendChild(document.createTextNode(message));
    return p;
  };

  var focusable =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  var handleFocus;

  var GENERIC_ERROR = buildMessage('message-error', strings.generic_error);
  var FORM_ERROR = buildMessage('message-error', strings.form_error);
  var FORM_SUCCESS = buildMessage('message-success', strings.sent_message);

  // XMLHttpRequest.DONE does not exist in all browsers
  var XHR_DONE = 4;

  var serialize = function (form) {
    var q = [];
    for (var i = 0; i < form.elements.length; i++) {
      q.push(form.elements[i].name + '=' + encodeURIComponent(form.elements[i].value));
    }
    return q.join('&');
  };

  var onReady = function (f) {
    /in/.test(document.readyState)
      ? setTimeout(function () {
          onReady(f);
        }, 9)
      : f();
  };

  var SentryErrorEmbed = function () {
    this.build();
  };

  SentryErrorEmbed.prototype.build = function () {
    var self = this;
    this.element = document.createElement('div');
    this.element.className = 'sentry-error-embed-wrapper';
    this.element.innerHTML = template;
    self.element.onclick = function (e) {
      if (e.target !== self.element) return;
      self.close();
    };

    this._form = this.element.getElementsByTagName('form')[0];
    this._form.onsumbit = function (e) {
      e.preventDefault();
      self.submit(self.serialize());
    };

    var buttons = this.element.getElementsByTagName('button');
    this._submitBtn = buttons[0];
    this._submitBtn.onclick = function (e) {
      e.preventDefault();
      self.submit(self.serialize());
    };

    var divTags = this._form.getElementsByTagName('div');
    var i;
    for (i = 0; i < divTags.length; i++) {
      if (divTags[i].className === 'error-wrapper') {
        this._errorWrapper = divTags[i];
      }
      if (divTags[i].className === 'form-content') {
        this._formContent = divTags[i];
      }
    }

    var cancelHandler = function (e) {
      e.preventDefault();
      self.close();
    };
    buttons[1].onclick = cancelHandler;

    this._formMap = {};
    var node;
    for (i = 0; i < this._form.elements.length; i++) {
      node = this._form.elements[i];
      this._formMap[node.name] = node.parentNode;
    }

    if (document.querySelectorAll) {
      var focusableElements = this.element.querySelectorAll(focusable);
      var firstFocus = focusableElements[0];
      var lastFocus = focusableElements[focusableElements.length - 1];
      // Trap focus to improve UX and help screenreaders.
      handleFocus = function (event) {
        var isTab = event.key === 'Tab' || event.keyCode === 9;
        if (!isTab) {
          return;
        }
        if (event.shiftKey) {
          if (document.activeElement === firstFocus) {
            lastFocus.focus();
            event.preventDefault();
          }
        } else {
          if (document.activeElement === lastFocus) {
            firstFocus.focus();
            event.preventDefault();
          }
        }
      };
      document.addEventListener('keydown', handleFocus);

      setTimeout(function () {
        firstFocus.focus();
      }, 1);
    }
  };

  SentryErrorEmbed.prototype.serialize = function () {
    return serialize(this._form);
  };

  SentryErrorEmbed.prototype.close = function () {
    if (handleFocus) {
      document.removeEventListener('keydown', handleFocus);
    }
    this.element.parentNode.removeChild(this.element);
  };

  SentryErrorEmbed.prototype.submit = function (body) {
    var self = this;
    if (this._submitInProgress) return;
    this._submitInProgress = true;

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
      if (xhr.readyState === XHR_DONE) {
        if (xhr.status === 200) {
          self.onSuccess();
        } else if (xhr.status === 400) {
          self.onFormError(JSON.parse(xhr.responseText));
        } else {
          setChild(self._errorWrapper, GENERIC_ERROR);
        }
        self._submitInProgress = false;
      }
    };
    xhr.open('POST', endpoint, true);
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    xhr.send(body);
  };

  SentryErrorEmbed.prototype.onSuccess = function () {
    this._errorWrapper.innerHTML = '';
    setChild(this._formContent, FORM_SUCCESS);
    this._submitBtn.parentNode.removeChild(this._submitBtn);
    if (handleFocus) {
      document.removeEventListener('keydown', handleFocus);
    }
  };

  SentryErrorEmbed.prototype.onFormError = function (data) {
    var node;
    for (var key in this._formMap) {
      node = this._formMap[key];
      if (data.errors[key]) {
        if (!/form-errors/.test(node.className)) {
          node.className += ' form-errors';
        }
      } else if (/form-errors/.test(node.className)) {
        node.className = node.className.replace(/form-errors/, '');
      }
    }
    setChild(this._errorWrapper, FORM_ERROR);
  };

  SentryErrorEmbed.prototype.attach = function (parent) {
    parent.appendChild(this.element);
  };

  var options = window.sentryConfig || {};
  var embed = new SentryErrorEmbed();
  if (options.attachOnLoad !== false) {
    onReady(function () {
      embed.attach(options.parent || document.body);
      if (window.sentryEmbedCallback && typeof sentryEmbedCallback === 'function') {
        sentryEmbedCallback(embed);
      }
    });
  }
})(window, document, JSON);
