/* eslint no-var:0 */
/* eslint-env commonjs */
// var webpack will bundle zxcvbn

module.exports = (function() {
  var zxcvbn = require('zxcvbn');
  var MAX = 5;
  var labels = ['', 'Very Weak', 'Very Weak', 'Weak', 'Strong', 'Very Strong'];
  var red = '#e03e2f';
  var yellow = '#ECD744';
  var green = '#57be8c';
  var colors = ['transparent', red, red, yellow, green, green];
  var $ = window.$;
  var throttle =
    (window._ && window._.throttle) ||
    function(f) {
      return f;
    };

  var setStrength = function(score, $bar, $label) {
    if (score > -1 && score <= MAX) {
      var scoreRatio = score === 0 ? 0 : score / MAX;
      var percent = Math.round(scoreRatio * 100);
      var color = colors[score] || 'transparent';
      var label = labels[score] || '';

      if ($bar && $bar.length && $label && $label.length) {
        var $sr = $bar.find('.sr-only');
        if ($sr && $sr.length) {
          $sr.text(percent + '%');
        }
        $bar.attr('aria-valuenow', percent);

        $bar.css({
          width: percent + '%',
          'background-color': color
        });

        $label.text(label).css({
          color: color
        });
      }
    }
  };

  var createIndicator = function(parent) {
    var $progress = $(
      '<div class="progress">' +
        '<div class="progress-bar" role="progressbar" aria-valuenow="60" aria-valuemin="0" aria-valuemax="100">' +
        '<span class="sr-only">0%</span>' +
        '</div>' +
        '</div>'
    );
    var $label = $(
      '<div class="password-strength-heading">' +
        'Password Strength: <span class="password-strength-label"></span>' +
        '</div>'
    );
    var $warning = $('<div class="password-warnings" />');
    $(parent).append($label, $progress, $warning);

    return {
      bar: $progress.find('.progress-bar'),
      label: $label.find('.password-strength-label'),
      warning: $warning
    };
  };

  var addStrengthIndicator = function(passwordSel, parent) {
    // Don't do anything if jquery OR zxcvbn do not exist in `window`
    if ($ && zxcvbn) {
      var els = createIndicator(parent);
      var $bar = els.bar;
      var $label = els.label;
      var $warning = els.warning;

      var setStrengthHandler = function() {
        var val = $(this).val();
        if (val) {
          $(parent).addClass('visible');
          var result = zxcvbn(val);
          if (result) {
            $warning.text(result.feedback.warning);
            // Score is 0 indexed
            var score = result.score + 1;
            setStrength(score, $bar, $label);
          } else {
            setStrength(0);
          }
        } else {
          setStrength(0);
        }
      };

      $(passwordSel).on('input', throttle(setStrengthHandler));
    }
  };

  return {
    addStrengthIndicator: addStrengthIndicator
  };
})();
