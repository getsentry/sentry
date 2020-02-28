import PropTypes from 'prop-types';
import React from 'react';
import sortBy from 'lodash/sortBy';
import styled from '@emotion/styled';

import ContextData from 'app/components/contextData';
import theme from 'app/utils/theme';

class KeyValueList extends React.Component {
  static propTypes = {
    data: PropTypes.any.isRequired,
    isContextData: PropTypes.bool,
    isSorted: PropTypes.bool,
    onClick: PropTypes.func,
    raw: PropTypes.bool,
    longKeys: PropTypes.bool,
  };

  static defaultProps = {
    isContextData: false,
    isSorted: true,
    raw: false,
    longKeys: false,
  };

  render() {
    // TODO(dcramer): use non-string keys as reserved words ("unauthorized")
    // break rendering

    let data = this.props.data;
    if (data === undefined || data === null) {
      data = [];
    } else if (!(data instanceof Array)) {
      data = Object.keys(data).map(key => [key, data[key]]);
    } else {
      data = data.filter(kv => kv !== null);
    }

    data = this.props.isSorted ? sortBy(data, [([key]) => key]) : data;
    const raw = this.props.raw;
    const props = this.props.onClick ? {onClick: this.props.onClick} : {};
    return (
      <table className="table key-value" {...props}>
        <tbody>
          {data.map(([key, value]) => {
            if (this.props.isContextData) {
              return [
                <tr key={key}>
                  <TableData className="key" wide={this.props.longKeys}>
                    {key}
                  </TableData>
                  <td className="val">
                    <ContextData data={!raw ? value : JSON.stringify(value)} />
                  </td>
                </tr>,
              ];
            } else {
              return [
                <tr key={key}>
                  <TableData className="key" wide={this.props.longKeys}>
                    {key}
                  </TableData>
                  <td className="val">
                    <pre className="val-string">{'' + value || ' '}</pre>
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

const TableData = styled('td')`
  @media (min-width: ${theme.breakpoints[2]}) {
    max-width: ${p => (p.wide ? '620px !important' : null)};
  }
`;

KeyValueList.displayName = 'KeyValueList';

export default KeyValueList;
