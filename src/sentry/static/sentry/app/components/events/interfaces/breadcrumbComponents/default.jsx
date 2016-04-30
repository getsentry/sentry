import React from 'react';
import moment from 'moment';
import _ from 'underscore';

import Classifier from './classifier';

const DefaultCrumbComponent = React.createClass({
  propTypes: {
    crumb: React.PropTypes.object.isRequired,
  },

  render() {
    let crumb = this.props.crumb;

    let message = crumb.message || crumb.data && crumb.data.message;

    let category = crumb.category || 'default';
    let body = _.chain(crumb.data)
      .map((val, key) => [val, key])
      .filter(([val, key]) => key !== 'message' && key !== 'level' && key !== 'classifier')
      .map(([val, key]) => {
        return (
          <tr key={key}>
            <td className="key">{key}</td>
            <td><pre>{val + ''}</pre></td>
          </tr>
        );
      })
      .value();

    return (
      <li className={'crumb crumb-' + category}>
        <span className="icon-container">
          <span className="icon"/>
        </span>
        <span className="dt">{moment(crumb.timestamp).format('HH:mm:ss')}</span>
        <table className="table key-value">
          <thead>
            <tr>
              <td className="key">{crumb.type}</td>
              <td>
                {message &&
                  <pre>
                    <code>{message}</code>
                    <Classifier value={crumb.classifier} hideIfEmpty={true}/>
                  </pre>
                }
              </td>
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

export default DefaultCrumbComponent;
