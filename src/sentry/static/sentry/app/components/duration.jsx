import React from 'react';

const Duration = React.createClass({
  propTypes: {
    seconds: React.PropTypes.number.isRequired
  },

  getDuration() {
    let value = Math.abs(this.props.seconds * 1000);
    let result = '';

    if (value >= 604800000) {  // one week
      result = Math.round(value / 604800000);
      result = (result !== 1 ? result + ' weeks' : result + ' week');
    } else if (value >= 172800000) {  // two days
      result = Math.round(value / 86400000);
      result = (result !== 1 ? result + ' days' : result + ' day');
    }  else if (value >= 7200000) {
      result = Math.round(value / 3600000);
      result = (result !== 1 ? result + ' hours' : result + ' hour');
    } else if (value >= 120000) {
      result = Math.round(value / 60000);
      result = (result !== 1 ? result + ' minutes' : result + ' minute');
    } else if (value >= 1000) {
      result = Math.round(value / 1000);
      result = (result !== 1 ? result + ' seconds' : result + ' second');
    } else {
      result = Math.round(value) + ' ms';
    }

    return result;
  },

  render() {
    return (
      <span className={this.props.className}>{this.getDuration()}</span>
    );
  }
});

export default Duration;
