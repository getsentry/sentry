import React from 'react';
import _ from 'underscore';

import Category from './category';


const CrumbTable = React.createClass({
  propTypes: {
    crumb: React.PropTypes.object,
    title: React.PropTypes.string,
    kvData: React.PropTypes.object,
    summary: React.PropTypes.object,
  },

  renderData() {
    if (!this.props.kvData) {
      return null;
    }
    return _.chain(this.props.kvData)
      .map((val, key) => [val, key])
      .map(([val, key]) => {
        return (
          <tr key={key}>
            <td className="key">{key}</td>
            <td className="value"><pre>{val + ''}</pre></td>
          </tr>
        );
      })
      .value();
  },

  render() {
    return (
      <table className="table key-value">
        <thead>
          <tr>
            <td className="key">
              <Category value={this.props.crumb.category}/>
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
});

export default CrumbTable;
