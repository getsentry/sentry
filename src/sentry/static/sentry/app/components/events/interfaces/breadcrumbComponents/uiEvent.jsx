import React from 'react';

import Classifier from './classifier';
import KeyValueList from '../keyValueList';

const UiEventComponent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let data = this.props.data;

    let list = [];
    list.push(['element', data.target || 'undefined target']);

    return (
      <div>
        <h5>{data.type || 'UI Event'} <Classifier value={data.classifier} title="%s call"/></h5>
        <KeyValueList data={list} isSorted={false} />
      </div>
    );
  }
});

export default UiEventComponent;
