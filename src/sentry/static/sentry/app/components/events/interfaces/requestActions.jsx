import React from "react";
import ConfigStore from "../../../stores/configStore";

var RequestActions = React.createClass({
  render(){
    var org = this.props.organization;
    var project = this.props.project;
    var group = this.props.group;
    var evt = this.props.event;
    var urlPrefix = (
      ConfigStore.get('urlPrefix') + '/' + org.slug + '/' +
      project.slug + '/group/' + group.id
    );

    return (
      <a href={urlPrefix + '/events/' + evt.id + '/replay/'}
         className="btn btn-sm btn-default">Replay Request</a>
    );
  }
});

export default RequestActions;