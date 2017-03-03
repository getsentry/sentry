/*
 jQuery Simple Slider

 Copyright (c) 2015 Sentry Team (https://getsentry.com)
 Copyright (c) 2012 James Smith (http://loopj.com)

 Licensed under the MIT license (http://mit-license.org/)
*/

var __slice = [].slice,
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

var $ = require('jquery');

function SimpleSlider(input, options) {
  var ratio,
    _this = this;
  this.input = input;
  this.defaultOptions = {
    animate: true,
    snapMid: false,
    classPrefix: null,
    classSuffix: null,
    theme: null,
    highlight: false
  };
  this.settings = $.extend({}, this.defaultOptions, options);
  if (this.settings.theme) {
    this.settings.classSuffix = "-" + this.settings.theme;
  }
  this.input.hide();
  this.slider = $("<div>").addClass("slider" + (this.settings.classSuffix || "")).css({
    position: "relative",
    userSelect: "none",
    boxSizing: "border-box"
  }).insertBefore(this.input);
  if (this.input.attr("id")) {
    this.slider.attr("id", this.input.attr("id") + "-slider");
  }
  this.track = this.createDivElement("track").css({
    width: "100%"
  });
  if (this.settings.highlight) {
    this.highlightTrack = this.createDivElement("highlight-track").css({
      width: "0"
    });
  }
  this.dragger = this.createDivElement("dragger");
  this.slider.css({
    minHeight: this.dragger.outerHeight(),
    marginLeft: this.dragger.outerWidth() / 2,
    marginRight: this.dragger.outerWidth() / 2
  });
  this.track.css({
    marginTop: this.track.outerHeight() / -2
  });
  if (this.settings.highlight) {
    this.highlightTrack.css({
      marginTop: this.track.outerHeight() / -2
    });
  }
  this.dragger.css({
    marginTop: this.dragger.outerHeight() / -2,
    marginLeft: this.dragger.outerWidth() / -2
  });
  this.track.mousedown(function(e) {
    return _this.trackEvent(e);
  });
  if (this.settings.highlight) {
    this.highlightTrack.mousedown(function(e) {
      return _this.trackEvent(e);
    });
  }
  this.dragger.mousedown(function(e) {
    if (e.which !== 1) {
      return;
    }
    _this.dragging = true;
    _this.dragger.addClass("dragging");
    _this.domDrag(e.pageX, e.pageY);
    return false;
  });
  $("body").mousemove(function(e) {
    if (_this.dragging) {
      _this.domDrag(e.pageX, e.pageY);
      return $("body").css({
        cursor: "pointer"
      });
    }
  }).mouseup(function(e) {
    if (_this.dragging) {
      _this.dragging = false;
      _this.dragger.removeClass("dragging");
      return $("body").css({
        cursor: "auto"
      });
    }
  });
  this.pagePos = 0;
  if (this.input.val() === "") {
    this.value = this.getRange().min;
    this.input.val(this.value);
  } else {
    this.value = this.nearestValidValue(this.input.val());
  }
  this.setSliderPositionFromValue(this.value);
  ratio = this.valueToRatio(this.value);
  this.input.trigger("slider:ready", {
    value: this.value,
    ratio: ratio,
    position: ratio * this.slider.outerWidth(),
    el: this.slider
  });
}

SimpleSlider.prototype.createDivElement = function(classname) {
  var item;
  item = $("<div>").addClass(classname).css({
    position: "absolute",
    top: "50%",
    userSelect: "none",
    cursor: "pointer"
  }).appendTo(this.slider);
  return item;
};

SimpleSlider.prototype.setRatio = function(ratio) {
  var value;
  ratio = Math.min(1, ratio);
  ratio = Math.max(0, ratio);
  value = this.ratioToValue(ratio);
  this.setSliderPositionFromValue(value);
  return this.valueChanged(value, ratio, "setRatio");
};

SimpleSlider.prototype.setValue = function(value) {
  var ratio;
  value = this.nearestValidValue(value);
  ratio = this.valueToRatio(value);
  this.setSliderPositionFromValue(value);
  return this.valueChanged(value, ratio, "setValue");
};

SimpleSlider.prototype.trackEvent = function(e) {
  if (e.which !== 1) {
    return;
  }
  this.domDrag(e.pageX, e.pageY, true);
  this.dragging = true;
  return false;
};

SimpleSlider.prototype.domDrag = function(pageX, pageY, animate) {
  var pagePos, ratio, value;
  if (animate == null) {
    animate = false;
  }
  pagePos = pageX - this.slider.offset().left;
  pagePos = Math.min(this.slider.outerWidth(), pagePos);
  pagePos = Math.max(0, pagePos);
  if (this.pagePos !== pagePos) {
    this.pagePos = pagePos;
    ratio = pagePos / this.slider.outerWidth();
    value = this.ratioToValue(ratio);
    this.valueChanged(value, ratio, "domDrag");
    if (this.settings.snap) {
      return this.setSliderPositionFromValue(value, animate);
    } else {
      return this.setSliderPosition(pagePos, animate);
    }
  }
};

SimpleSlider.prototype.setSliderPosition = function(position, animate) {
  if (animate == null) {
    animate = false;
  }
  if (animate && this.settings.animate) {
    this.dragger.animate({
      left: position
    }, 200);
    if (this.settings.highlight) {
      return this.highlightTrack.animate({
        width: position
      }, 200);
    }
  } else {
    this.dragger.css({
      left: position
    });
    if (this.settings.highlight) {
      return this.highlightTrack.css({
        width: position
      });
    }
  }
};

SimpleSlider.prototype.setSliderPositionFromValue = function(value, animate) {
  var ratio;
  if (animate == null) {
    animate = false;
  }
  ratio = this.valueToRatio(value);
  return this.setSliderPosition(ratio * this.slider.outerWidth(), animate);
};

SimpleSlider.prototype.getRange = function() {
  if (this.settings.allowedValues) {
    return {
      min: Math.min.apply(Math, this.settings.allowedValues),
      max: Math.max.apply(Math, this.settings.allowedValues)
    };
  } else if (this.settings.range) {
    return {
      min: parseFloat(this.settings.range[0]),
      max: parseFloat(this.settings.range[1])
    };
  } else {
    return {
      min: 0,
      max: 1
    };
  }
};

SimpleSlider.prototype.nearestValidValue = function(rawValue) {
  var closest, maxSteps, range, steps;
  range = this.getRange();
  rawValue = Math.min(range.max, rawValue);
  rawValue = Math.max(range.min, rawValue);
  if (this.settings.allowedValues) {
    closest = null;
    $.each(this.settings.allowedValues, function() {
      if (closest === null || Math.abs(this - rawValue) < Math.abs(closest - rawValue)) {
        return closest = this;
      }
    });
    return closest;
  } else if (this.settings.step) {
    maxSteps = (range.max - range.min) / this.settings.step;
    steps = Math.floor((rawValue - range.min) / this.settings.step);
    if ((rawValue - range.min) % this.settings.step > this.settings.step / 2 && steps < maxSteps) {
      steps += 1;
    }
    return steps * this.settings.step + range.min;
  } else {
    return rawValue;
  }
};

SimpleSlider.prototype.valueToRatio = function(value) {
  var allowedVal, closest, closestIdx, idx, range, _i, _len, _ref;
  if (this.settings.equalSteps) {
    _ref = this.settings.allowedValues;
    for (idx = _i = 0, _len = _ref.length; _i < _len; idx = ++_i) {
      allowedVal = _ref[idx];
      if (!(typeof closest !== "undefined" && closest !== null) || Math.abs(allowedVal - value) < Math.abs(closest - value)) {
        closest = allowedVal;
        closestIdx = idx;
      }
    }
    if (this.settings.snapMid) {
      return (closestIdx + 0.5) / this.settings.allowedValues.length;
    } else {
      return closestIdx / (this.settings.allowedValues.length - 1);
    }
  } else {
    range = this.getRange();
    return (value - range.min) / (range.max - range.min);
  }
};

SimpleSlider.prototype.ratioToValue = function(ratio) {
  var idx, range, rawValue, step, steps;
  if (this.settings.equalSteps) {
    steps = this.settings.allowedValues.length;
    step = Math.round(ratio * steps - 0.5);
    idx = Math.min(step, this.settings.allowedValues.length - 1);
    return this.settings.allowedValues[idx];
  } else {
    range = this.getRange();
    rawValue = ratio * (range.max - range.min) + range.min;
    return this.nearestValidValue(rawValue);
  }
};

SimpleSlider.prototype.valueChanged = function(value, ratio, trigger) {
  var eventData;
  if (value.toString() === this.value.toString()) {
    return;
  }
  this.value = value;
  eventData = {
    value: value,
    ratio: ratio,
    position: ratio * this.slider.outerWidth(),
    trigger: trigger,
    el: this.slider
  };
  return this.input.val(value).trigger($.Event("change", eventData)).trigger("slider:changed", eventData);
};

$.extend($.fn, {
  simpleSlider: function() {
    var params, publicMethods, settingsOrMethod;
    settingsOrMethod = arguments[0], params = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    publicMethods = ["setRatio", "setValue"];
    return $(this).each(function() {
      var obj, settings;
      if (settingsOrMethod && __indexOf.call(publicMethods, settingsOrMethod) >= 0) {
        obj = $(this).data("slider-object");
        return obj[settingsOrMethod].apply(obj, params);
      } else {
        settings = settingsOrMethod;
        return $(this).data("slider-object", new SimpleSlider($(this), settings));
      }
    });
  }
});

module.exports = SimpleSlider;
