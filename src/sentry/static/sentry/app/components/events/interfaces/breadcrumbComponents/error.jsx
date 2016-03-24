import React from 'react';

import KeyValueList from '../keyValueList';

function Error(props) {
  let {type, value} = props.data;

  let list = [];
  list.push(['type', type]);
  list.push(['message', value]);

  return (
    <div>
      <h5>Error</h5>
      <KeyValueList data={list} isSorted={false} />
    </div>
  );
}

Error.propTypes = {
  data: React.PropTypes.object.isRequired
};

export default Error;
