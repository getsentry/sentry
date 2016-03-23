import React from 'react';

import Classifier from './classifier';

const UiEventComponent = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let data = this.props.data;
    return (
      <div>
        <h5>{data.event || 'UI Event'} <Classifier value={data.classifier} title="%s call"/></h5>
        <table className="table key-value">
          <tbody>
            <tr>
              <td className="key">element</td>
              <td>
                <pre>{data.target || 'undefined target'}</pre>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
});

export default UiEventComponent;
