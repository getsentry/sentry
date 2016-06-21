import React from 'react';
import _ from 'underscore';

import {defined} from '../../../../utils';
import KeyValueList from '../keyValueList';


const ContextBlock = React.createClass({
  propTypes: {
    alias: React.PropTypes.string.isRequired,
    title: React.PropTypes.string,
    data: React.PropTypes.object.isRequired,
    knownData: React.PropTypes.array,
  },

  render() {
    let data = [];
    let className = `context-block context-block-${this.props.data.type}`;
    let title = this.props.title || this.props.data.title;
    let alias = null;

    if (!title) {
      title = this.props.alias;
    } else {
      alias = (
        <small>{' ('}{this.props.alias})</small>
      );
    }

    (this.props.knownData || []).forEach(([key, value]) => {
      if (defined(value)) {
        data.push([key, value]);
      }
    });

    let extraData = [];
    for (let key in this.props.data) {
      if (key !== 'type') {
        extraData.push([key, this.props.data[key]]);
      }
    }

    if (extraData.length > 0) {
      data = data.concat(_.sortBy(extraData, (key, value) => key));
    }

    return (
      <div className={className}>
        <h4>{title}{alias}</h4>
        <KeyValueList data={data} isSorted={false} />
      </div>
    );
  }
});

export default ContextBlock;
