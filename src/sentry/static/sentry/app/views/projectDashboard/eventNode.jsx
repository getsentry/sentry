import React from 'react';

import createReactClass from 'create-react-class';

import Count from 'app/components/count';
import EventOrGroupExtraDetails from 'app/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'app/components/eventOrGroupHeader';
import ProjectState from 'app/mixins/projectState';
import SentryTypes from 'app/proptypes';

const EventNode = createReactClass({
  displayName: 'EventNode',

  propTypes: {
    group: SentryTypes.Group.isRequired,
  },

  mixins: [ProjectState],

  render() {
    let group = this.props.group;
    let userCount = group.userCount;
    let org = this.getOrganization();

    let orgId = org.slug;
    let projectId = group.project.slug;
    let groupId = group.id;

    return (
      <li className="group row">
        <div className="col-xs-8 event-details">
          <EventOrGroupHeader
            orgId={orgId}
            projectId={projectId}
            data={group}
            hideIcons
            hideLevel
          />
          <EventOrGroupExtraDetails
            orgId={orgId}
            projectId={projectId}
            groupId={groupId}
            lastSeen={group.lastSeen}
            firstSeen={group.firstSeen}
          />
        </div>

        <div className="col-xs-2 event-count align-right">
          <Count value={group.count} />
        </div>
        <div className="col-xs-2 event-users align-right">
          <Count value={userCount} />
        </div>
      </li>
    );
  },
});

export default EventNode;
