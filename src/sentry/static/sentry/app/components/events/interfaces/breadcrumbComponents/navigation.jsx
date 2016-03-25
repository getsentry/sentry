import React from 'react';

import KeyValueList from '../keyValueList';

const NavigationCrumbComponent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let data = this.props.data;

    let list = [];
    list.push(['from', data.from]);
    list.push(['to', data.to]);

    return (
      <div>
        <h5>Navigation</h5>
        <KeyValueList data={list} isSorted={false} />
      </div>
    );
  }
});

export default NavigationCrumbComponent;
