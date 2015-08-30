import React from "react";
import Version from "../../components/version";

var ReleaseWidget = React.createClass({
  render() {
    var release = this.props.data;

    return (
      <div className="user-widget">
        <h6><span>Release</span></h6>
        <dl>
          <dt key={4}>Version:</dt>
          <dd key={5}><Version version={release.version} /></dd>
        </dl>
      </div>
    );
  }
});

export default ReleaseWidget;