import React from 'react';
import _ from 'underscore';

import ContextData from '../../contextData';

const KeyValueList = React.createClass({
  propTypes: {
    data: React.PropTypes.array.isRequired,
    isContextData: React.PropTypes.bool
  },

  getDefaultProps() {
    return {
      isContextData: false
    };
  },

  render() {
    let data = _.sortBy(this.props.data, (key, value) => key);
    return (
      <table className="table key-value">
        {data.map(([key, value]) => {
          if (this.props.isContextData) {
            return [
              <tr key={key}>
                <td>{key}</td>
                <td><ContextData data={value}/></td>
              </tr>
            ];
          } else {
            return [
              <tr key={key}>
                <td>{key}</td>
                <td><pre>{'' + value || ' '}</pre></td>
              </tr>
            ];
          }
        })}
      </table>
    );
  }
});

export default KeyValueList;
