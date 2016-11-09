import React from 'react';
import _ from 'underscore';

import ContextData from '../../contextData';
import {deviceNameMapper} from '../../../utils';

const KeyValueList = React.createClass({
  propTypes: {
    data: React.PropTypes.any.isRequired,
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

    let data = this.props.data;
    if (data === undefined || data === null) {
      data = [];
    } else if (!(data instanceof Array)) {
      data = Object.keys(data).map((key) => [key, data[key]]);
    }

    data = this.props.isSorted ? _.sortBy(data, (key, value) => key) : data;

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
                <td className="value"><pre>{deviceNameMapper('' + value || ' ')}</pre></td>
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
