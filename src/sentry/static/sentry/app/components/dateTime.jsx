import React from 'react';
import moment from 'moment';
import ConfigStore from '../stores/configStore.jsx';
import _ from 'underscore';

const DateTime = React.createClass({
  propTypes: {
    date: React.PropTypes.any.isRequired,
    seconds: React.PropTypes.bool
  },

  getDefaultProps() {
    return {
      seconds: true,
    };
  },

  getDefaultFormat() {
    return this.props.seconds ? 'll LTS z' : 'lll';
  },

  render() {
    let date = this.props.date;
    let user = ConfigStore.get('user');
    let options = user ? user.options : {};
    let format = options.clock24Hours ? 'MMMM D YYYY HH:mm:ss z' : this.getDefaultFormat();

    if (_.isString(date) || _.isNumber(date)) {
      date = new Date(date);
    }

    let carriedProps = _.omit(this.props, 'date', 'seconds');
    return (
      <time {...carriedProps}>{moment(date).format(format)}</time>
    );
  }
});

export default DateTime;

