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
    list.push([data.type, data.target || 'undefined target']);

    return (
      <div>
        <h5>UI Event
          <Classifier value={data.classifier} title="%s call" hideIfEmpty={true}/>
        </h5>
        <KeyValueList data={list} isSorted={false} />
      </div>
    );
  }
});

export default UiEventComponent;
