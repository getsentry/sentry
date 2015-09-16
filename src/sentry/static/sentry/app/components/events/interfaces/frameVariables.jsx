import React from "react";

import ContextData from "../../contextData";

var FrameVariables = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired
  },

  // make sure that clicking on the variables does not actually do
  // anything on the containing element.
  preventToggling(evt) {
    evt.stopPropagation();
  },

  render() {
    var children = [];
    var data = this.props.data;

    for (var key in data) {
      var value = data[key];
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
