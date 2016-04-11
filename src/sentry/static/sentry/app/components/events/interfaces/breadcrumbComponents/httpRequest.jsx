import React from 'react';

import Classifier from './classifier';
import KeyValueList from '../keyValueList';

const HttpRequestCrumbComponent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  test() {
    return 42;
  },

  render() {
    let data = this.props.data;

    let list = [];
    list.push([data.method, data.url]);

    if(data.response) {
      list.push(['response', data.response.statusCode]);
    }

    return (
      <div>
        <h5>HTTP Request
          <Classifier value={data.classifier} title="%s request" hideIfEmpty={true}/>
        </h5>
        <KeyValueList data={list} isSorted={false} />
      </div>
    );
  }
});

export default HttpRequestCrumbComponent;
