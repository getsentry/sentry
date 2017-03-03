import React from 'react';
import {Link} from 'react-router';
import Count from '../../components/count';
import PropTypes from '../../proptypes';
import TimeSince from '../../components/timeSince';
import ProjectState from '../../mixins/projectState';

const EventNode = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired
  },

  mixins: [ProjectState],

  makeGroupLink(title) {
    let group = this.props.group;
    let org = this.getOrganization();

    let orgId = org.slug;
    let projectId = group.project.slug;
    let groupId = group.id;

    return (
      <Link to={`/${orgId}/${projectId}/issues/${groupId}/`}>
        {title}
      </Link>
    );
  },

  render() {
    let group = this.props.group;
    let userCount = group.userCount;

    return (
      <li className="group">
        <div className="row">
          <div className="col-xs-8 event-details">
            <h3 className="truncate">{this.makeGroupLink(group.title)}</h3>
            <div className="event-message">{group.culprit}</div>
            <div className="event-extra">
              <ul>
                <li>
                  <span className="icon icon-clock"></span>
                  <TimeSince date={group.lastSeen} />
                  &nbsp;&mdash;&nbsp;
                  <TimeSince date={group.firstSeen} suffix="old" />
                </li>
              </ul>
            </div>
          </div>
          <div className="col-xs-2 event-count align-right">
            <Count value={group.count} />
          </div>
          <div className="col-xs-2 event-users align-right">
            <Count value={userCount} />
          </div>
        </div>
      </li>
    );
  }
});

export default EventNode;
