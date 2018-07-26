import React from 'react';
import PropTypes from 'prop-types';

export default class Result extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
    query: PropTypes.object.isRequired,
  };

  render() {
    const {aggregations, fields} = this.props.query;
    // TODO: implement charts
    return (
      `data for charts: ${JSON.stringify(this.props.data)} ` +
      `chart query: ${fields} ${aggregations}`
    );
  }
}
