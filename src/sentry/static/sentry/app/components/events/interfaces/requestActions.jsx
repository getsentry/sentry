import React from 'react';
import ConfigStore from '../../../stores/configStore';

const RequestActions = React.createClass({
  render(){
    let org = this.props.organization;
    let project = this.props.project;
    let group = this.props.group;
    let evt = this.props.event;
    let urlPrefix = (
      ConfigStore.get('urlPrefix') + '/' + org.slug + '/' +
      project.slug + '/issues/' + group.id
    );

    return (
      <a href={urlPrefix + '/events/' + evt.id + '/replay/'}
         className="btn btn-sm btn-default">Replay Request</a>
    );
  }
});

export default RequestActions;
