import React from 'react';

import Classifier from './classifier';

const HttpRequestCrumbComponent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  test() {
    return 42;
  },

  render() {
    let data = this.props.data;

    return (
      <p>
        <strong>HTTP Request</strong>{' '}
        <code>{data.method}</code>
        {' to '}
        <code>{data.url}</code>{' '}
        {data.response ?
          <span>({'response: '}<code>{data.response.statusCode}</code>)</span> :
          null}
        <Classifier value={data.classifier} title="%s request" />
      </p>
    );
  }
});

export default HttpRequestCrumbComponent;
