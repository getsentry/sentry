import React from 'react';

const NavigationCrumbComponent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let data = this.props.data;

    return (
      <div>
        <h5>Navigation</h5>
        <table className="table key-value">
          <tbody>
            {data.from &&
              <tr><td className="key">from</td><td><pre>{data.from}</pre></td></tr>}
            <tr>
              <td className="key">to</td>
              <td>
                <pre>{data.to}</pre>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
});

export default NavigationCrumbComponent;
