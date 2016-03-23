import React from 'react';

function Error(props) {
  let {type, value} = props.data;
  return (
    <p>
      <strong style={{color:'red'}}>{type}</strong> <span>{value}</span>
    </p>
  );
}

Error.propTypes = {
  data: React.PropTypes.object.isRequired
};

export default Error;

