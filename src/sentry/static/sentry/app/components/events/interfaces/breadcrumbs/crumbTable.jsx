import PropTypes from 'prop-types';
import React from 'react';
import map from 'lodash/map';
import isObject from 'lodash/isObject';
import styled from 'react-emotion';

import Category from 'app/components/events/interfaces/breadcrumbs/category';
import {PlatformContext} from 'app/components/events/interfaces/breadcrumbs/platformContext';
import theme from 'app/utils/theme';

class CrumbTable extends React.Component {
  static propTypes = {
    crumb: PropTypes.object,
    kvData: PropTypes.object,
    summary: PropTypes.object,
  };
  static contextType = PlatformContext;

  renderData = () => {
    if (!this.props.kvData) {
      return null;
    }
    return map(this.props.kvData, (val, key) => {
      return (
        <tr key={key}>
          <td className="key">{key}</td>
          <td className="value">
            <pre>{isObject(val) ? JSON.stringify(val) : val}</pre>
          </td>
        </tr>
      );
    });
  };

  render() {
    const platform = this.context;
    const widerCategory = platform === 'csharp';

    return (
      <table className="table key-value">
        <thead>
          <tr>
            <TableData className="key" wide={widerCategory}>
              <Category value={this.props.crumb.category} />
            </TableData>
            <td className="value">{this.props.summary}</td>
          </tr>
        </thead>
        <tbody>
          {this.props.children}
          {this.renderData()}
        </tbody>
      </table>
    );
  }
}

const TableData = styled('td')`
  @media (min-width: ${theme.breakpoints[2]}) {
    max-width: ${p => (p.wide ? '215px !important' : null)};
    width: ${p => (p.wide ? '215px !important' : null)};
  }
`;

export default CrumbTable;
