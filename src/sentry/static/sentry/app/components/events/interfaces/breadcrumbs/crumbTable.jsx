import PropTypes from 'prop-types';
import React from 'react';
import map from 'lodash/map';
import isObject from 'lodash/isObject';

import Category from 'app/components/events/interfaces/breadcrumbs/category';
import {PlatformContext} from 'app/components/events/interfaces/breadcrumbs/platformContext';

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
            <td
              className="key"
              css={
                widerCategory && {maxWidth: '200px !important', width: '200px !important'}
              }
            >
              <Category value={this.props.crumb.category} />
            </td>
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

export default CrumbTable;
