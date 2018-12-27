import PropTypes from 'prop-types';
import React from 'react';

import createReactClass from 'create-react-class';

export default createReactClass({
  displayName: 'count',

  propTypes: {
    value: PropTypes.any.isRequired,
  },

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.value !== nextProps.value;
  },

  numberFormats: [[1000000000, 'b'], [1000000, 'm'], [1000, 'k']],

  floatFormat(number, places) {
    let multi = Math.pow(10, places);
    return parseInt(number * multi, 10) / multi;
  },

  formatNumber(number) {
    let b, x, y, o, p;

    number = parseInt(number, 10);

    /*eslint no-cond-assign:0*/
    for (let i = 0; (b = this.numberFormats[i]); i++) {
      x = b[0];
      y = b[1];
      o = Math.floor(number / x);
      p = number % x;
      if (o > 0) {
        if (o / 10 > 1 || !p) return '' + o + y;
        return '' + this.floatFormat(number / x, 1) + y;
      }
    }
    return '' + number.toLocaleString();
  },

  render() {
    let {value, className} = this.props;

    return <span className={className}>{this.formatNumber(value)}</span>;
  },
});
