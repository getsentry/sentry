import React from 'react';
import PropTypes from 'prop-types';

export default class Result extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
  };

  render() {
    // TODO: implement charts
    return `data for charts: ${JSON.stringify(this.props.data)}`;
  }
}
