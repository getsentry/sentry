import React from 'react';
import _ from 'underscore';

import ContextData from '../../contextData';

const KeyValueList = React.createClass({
  propTypes: {
    data: React.PropTypes.array.isRequired,
    isContextData: React.PropTypes.bool,
    isSorted: React.PropTypes.bool,
    onClick: React.PropTypes.func
  },

  getDefaultProps() {
    return {
      isContextData: false,
      isSorted: true
    };
  },

  render() {
    // TODO(dcramer): use non-string keys as reserved words ("unauthorized")
    // break rendering

    let data = this.props.isSorted ?
                  _.sortBy(this.props.data, (key, value) => key) :
                  this.props.data;

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
