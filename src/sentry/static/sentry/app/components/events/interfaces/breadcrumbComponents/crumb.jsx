import React from 'react';
import moment from 'moment';
import _ from 'underscore';

import Category from './category';
import Duration from '../../../duration';

const CrumbComponent = React.createClass({
  propTypes: {
    crumb: React.PropTypes.object.isRequired,
  },

  renderSummary() {
    let {crumb} = this.props;
    let {message, type} = crumb;

    return (
      <div className="summary">
        {message && <pre><code>{message}</code></pre>}
        {crumb.category && <Category value={crumb.category}/>}
        {crumb.duration &&
          <span className="crumb-timing">
            [<Duration seconds={crumb.duration}/>]
          </span>
        }
      </div>
    );
  },

  getClassName() {
    let {crumb} = this.props;
    let rv = 'crumb crumb-default crumb-' + crumb.level;
    if (crumb.type !== 'default') {
      rv += ' crumb-' + crumb.type.replace(/[\s_]+/g, '-').toLowerCase();
    }
    return rv;
  },

  getTitle() {
    // TODO(mitsuhiko): refactor to support different types better
    let crumb = this.props.crumb;
    if (crumb.type === 'default') {
      return null;
    }
    return crumb.type.split(/[_-\s]+/g).map((word) => {
      return word.substr(0, 1).toUpperCase() + word.substr(1);
    }).join(' ');
  },

  getLevel() {
    // TODO(mitsuhiko): refactor to support different types better
    let crumb = this.props.crumb;
    if ((crumb.type !== 'default' && crumb.level === 'info') ||
        crumb.type === 'error') {
      return null;
    }
    return (
      <span className="crumb-level">{crumb.level}</span>
    );
  },

  render() {
    let crumb = this.props.crumb;
    let body = _.chain(crumb.data)
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

    return (
      <li className={this.getClassName()}>
        <span className="icon-container">
          <span className="icon"/>
        </span>
        <span className="dt">{moment(crumb.timestamp).format('HH:mm:ss')}</span>
        <table className="table key-value">
          <thead>
            <tr>
              <td className="key">
                {this.getTitle()}
                {this.getLevel()}
              </td>
              <td className="value">{this.renderSummary()}</td>
            </tr>
          </thead>
          {crumb.data &&
            <tbody>
              {body}
            </tbody>
          }
        </table>
      </li>
    );
  }
});

export default CrumbComponent;
