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
              <tr>
                <td key={'dt-' + key}>{key}</td>
                <td key={'dd-' + key}><ContextData data={value}/></td>
              </tr>
            ];
          } else {
            return [
              <tr>
                <td key={'dt-' + key}>{key}</td>
                <td key={'dd-' + key}><pre>{'' + value || ' '}</pre></td>
              </tr>
            ];
          }
        })}
      </table>
    );
  }
});

export default KeyValueList;
