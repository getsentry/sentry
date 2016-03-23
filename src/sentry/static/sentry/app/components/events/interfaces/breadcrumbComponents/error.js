import React from 'react';

function Error(props) {
  let {type, value} = props.data;
  return (
    <div>
      <h5>Error</h5>
      <table className="table key-value">
        <tbody>
          <tr>
            <td className="key">type</td>
            <td>
              <pre>{type}</pre>
            </td>
          </tr>
          <tr>
            <td className="key">message</td>
            <td>
              <pre>{value}</pre>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

Error.propTypes = {
  data: React.PropTypes.object.isRequired
};

export default Error;
