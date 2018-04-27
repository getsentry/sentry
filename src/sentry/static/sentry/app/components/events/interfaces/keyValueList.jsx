import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';

import ContextData from 'app/components/contextData';
import {deviceNameMapper} from 'app/utils';

class KeyValueList extends React.Component {
  static propTypes = {
    data: PropTypes.any.isRequired,
    isContextData: PropTypes.bool,
    isSorted: PropTypes.bool,
    onClick: PropTypes.func,
    raw: PropTypes.bool,
  };

  static defaultProps = {
    isContextData: false,
    isSorted: true,
    raw: false,
  };

  render() {
    // TODO(dcramer): use non-string keys as reserved words ("unauthorized")
    // break rendering

    let data = this.props.data;
    if (data === undefined || data === null) {
      data = [];
    } else if (!(data instanceof Array)) {
      data = Object.keys(data).map(key => [key, data[key]]);
    }

    data = this.props.isSorted ? _.sortBy(data, [([key]) => key]) : data;
    let raw = this.props.raw;
    const props = this.props.onClick ? {onClick: this.props.onClick} : {};
    return (
      <table className="table key-value" {...props}>
        <tbody>
          {data.map(([key, value]) => {
            if (this.props.isContextData) {
              return [
                <tr key={key}>
                  <td className="key">{key}</td>
                  <td className="value">
                    <ContextData data={!raw ? value : JSON.stringify(value)} />
                  </td>
                </tr>,
              ];
            } else {
              return [
                <tr key={key}>
                  <td className="key">{key}</td>
                  <td className="value">
                    <pre>{deviceNameMapper('' + value || ' ')}</pre>
                  </td>
                </tr>,
              ];
            }
          })}
        </tbody>
      </table>
    );
  }
}

KeyValueList.displayName = 'KeyValueList';

export default KeyValueList;
