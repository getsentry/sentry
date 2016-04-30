import React from 'react';
import moment from 'moment';
import _ from 'underscore';

import Classifier from './classifier';
import Duration from '../../../duration';

import QueryCrumbBody from './query';

const DefaultCrumbComponent = React.createClass({
  propTypes: {
    crumb: React.PropTypes.object.isRequired,
  },

  renderMessage() {
    let {crumb} = this.props;
    let {message, type} = crumb;

    return (
      <pre>
        {type === 'query' ?
          <QueryCrumbBody data={crumb}/> :
          <code>{message}</code>
        }
        {crumb.classifier && <Classifier value={crumb.classifier}/>}
        {crumb.duration &&
          <span className="timing">
            [<Duration seconds={crumb.duration}/>]
          </span>
        }
      </pre>
    );
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
            <td className="value"><pre>{val + ''}</pre></td>
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
              <td className="value">{message && this.renderMessage()}</td>
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
