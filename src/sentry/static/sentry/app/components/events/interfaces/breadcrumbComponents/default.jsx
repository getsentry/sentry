import React from 'react';
import _ from 'underscore';

import Classifier from './classifier';
import KeyValueList from '../keyValueList';

import ContextData from '../../../contextData';

const DefaultCrumbComponent = React.createClass({
  propTypes: {
    crumb: React.PropTypes.object.isRequired,
  },

  render() {
    let crumb = this.props.crumb;

    let message = crumb.message || crumb.data && crumb.data.message;

    let body = _.chain(crumb.data)
      .map((val, key) => [val, key])
      .filter(([val, key]) => key !== 'message' && key !== 'level' && key !== 'classifier')
      .map(([val, key]) => {
        return (
          <tr>
            <td className="key">{key}</td>
            <td><pre>{val + ''}</pre></td>
          </tr>
        );
      })
      .value();

    return (
      <table className="table key-value">
        <thead>
          <tr>
            <td className="key">{crumb.type}</td>
            <td>{message && <pre><code>{message}</code></pre>}</td>
          </tr>
        </thead>
        {crumb.data &&
          <tbody>
            {body}
          </tbody>
        }
      </table>

    );
  }
});

export default DefaultCrumbComponent;
