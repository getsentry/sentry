import React from 'react';

import ConfigStore from '../../../stores/configStore';
import {t} from '../../../locale';

const RequestActions = React.createClass({
  propTypes: {
    organization: React.PropTypes.object.isRequired,
    project: React.PropTypes.object.isRequired,
    group: React.PropTypes.object.isRequired,
    event: React.PropTypes.object.isRequired
  },

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
         className="btn btn-sm btn-default">{t('Replay Request')}</a>
    );
  }
});

export default RequestActions;
