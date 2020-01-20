import PropTypes from 'prop-types';
import React from 'react';
import map from 'lodash/map';
import isObject from 'lodash/isObject';

import Category from 'app/components/events/interfaces/breadcrumbs/category';

class CrumbTable extends React.Component {
  static propTypes = {
    crumb: PropTypes.object,
    kvData: PropTypes.object,
    summary: PropTypes.object,
  };

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
    return (
      <table className="table key-value">
        <thead>
          <tr>
            <td className="key">
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
