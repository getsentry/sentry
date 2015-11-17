import React from 'react';
import _ from 'underscore';

import ContextData from '../../contextData';

const KeyValueList = React.createClass({
  propTypes: {
    data: React.PropTypes.array.isRequired,
    isContextData: React.PropTypes.bool,
    onClick: React.PropTypes.func
  },

  getDefaultProps() {
    return {
      isContextData: false
    };
  },

  render() {
    let data = _.sortBy(this.props.data, (key, value) => key);
    const props = (this.props.onClick) ? {onClick: this.props.onClick} : {};
    return (
      <table className="table key-value" {...props}>
        <tbody>
        {data.map(([key, value]) => {
          if (this.props.isContextData) {
            return [
              <tr key={key}>
                <td className="key">{key}</td>
                <td className="value"><ContextData data={value}/></td>
              </tr>
            ];
          } else {
            return [
              <tr key={key}>
                <td className="key">{key}</td>
                <td className="value"><pre>{'' + value || ' '}</pre></td>
              </tr>
            ];
          }
        })}
        </tbody>
      </table>
    );
  }
});

export default KeyValueList;
