import React from 'react';

import ContextData from '../../contextData';

const FrameVariables = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired
  },

  // make sure that clicking on the variables does not actually do
  // anything on the containing element.
  preventToggling(evt) {
    evt.stopPropagation();
  },

  render() {
    let children = [];
    let data = this.props.data;

    for (let key in data) {
      let value = data[key];
      children.push(<tr key={key}><td>{key}</td><td><ContextData data={value} /></td></tr>);
    }

    return (
      <table className="table key-value expandable" onClick={this.preventToggling}><tbody>{children}</tbody></table>
    );
  }
});

export default FrameVariables;
