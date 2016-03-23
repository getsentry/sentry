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
      <div>
        <h5>HTTP Request <Classifier value={data.classifier} title="%s request" /></h5>
        <table className="table key-value">
          <tbody>
            <tr>
              <td className="key">method</td>
              <td>
                <pre>{data.method}</pre>
              </td>
            </tr>
            <tr>
              <td className="key">url</td>
              <td>
                <pre>{data.url}</pre>
              </td>
            </tr>
            {data.response ?
              <tr><td className="key">response</td><td><pre>{data.response.statusCode}</pre></td></tr> :
              null}
          </tbody>
        </table>
      </div>
    );
  }
});

export default HttpRequestCrumbComponent;
