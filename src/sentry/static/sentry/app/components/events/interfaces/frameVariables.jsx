import React from "react";

import ContextData from "../../contextData";

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
      children.push(<dt key={'dt-' + key}>{key}</dt>);
      children.push((
        <dd key={'dd-' + key}>
          <ContextData data={value} />
        </dd>
      ));
    }

    return (
      <dl className="vars expandable" onClick={this.preventToggling}>{children}</dl>
    );
  }
});

export default FrameVariables;
