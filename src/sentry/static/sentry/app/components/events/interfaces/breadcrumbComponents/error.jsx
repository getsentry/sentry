import React from 'react';

import KeyValueList from '../keyValueList';

function Error(props) {
  let {type, value, message, eventId} = props.data;

  let list = [];
  if (type && value) {
    list.push(['type', type]);
    list.push(['message', value]);
  }
  if (message) {
    list.push(['message', message]);
  }
  if (eventId) {
    list.push(['event_id', eventId]);
  }

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
