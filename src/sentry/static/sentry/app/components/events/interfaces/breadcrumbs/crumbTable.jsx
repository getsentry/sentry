import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';

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
    return _.map(this.props.kvData, (val, key) => {
      return (
        <tr key={key}>
          <td className="key">{key}</td>
          <td className="value">
            <pre>{val + ''}</pre>
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
