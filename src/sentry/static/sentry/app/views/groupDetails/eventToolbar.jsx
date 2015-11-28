import {Link} from 'react-router';
import React from 'react';
import PropTypes from '../../proptypes';
import DateTime from '../../components/dateTime';
import FileSize from '../../components/fileSize';
import {t} from '../../locale';

let GroupEventToolbar  = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
  },

  render() {
    let evt = this.props.event;

    let {orgId, projectId} = this.props;
    let groupId = this.props.group.id;

    let eventNavNodes = [
      (evt.previousEventID ?
        <Link
            key="oldest"
            to={`/${orgId}/${projectId}/issues/${groupId}/events/oldest/`}
            className="btn btn-default"
            title={t('Oldest')}>
            <span className="icon-skip-back"></span>
        </Link>
      :
        <a key="oldest"
          className="btn btn-default disabled"><span className="icon-skip-back"></span></a>
      ),
      (evt.previousEventID ?
        <Link
            key="prev"
            to={`/${orgId}/${projectId}/issues/${groupId}/events/${evt.previousEventID}/`}
            className="btn btn-default">{t('Older')}</Link>
      :
        <a key="prev"
           className="btn btn-default disabled">{t('Older')}</a>
      ),
      (evt.nextEventID ?
        <Link
            key="next"
            to={`/${orgId}/${projectId}/issues/${groupId}/events/${evt.nextEventID}/`}
            className="btn btn-default">{t('Newer')}</Link>
      :
        <a key="next"
           className="btn btn-default disabled">{t('Newer')}</a>
      ),
      (evt.nextEventID ?
        <Link
          key="latest"
          to={`/${orgId}/${projectId}/issues/${groupId}/events/latest/`}
          className="btn btn-default"
          title={t('Newest')}>
          <span className="icon-skip-forward"></span>
        </Link>
      :
        <a key="latest"
          className="btn btn-default disabled"><span className="icon-skip-forward"></span></a>
      )
    ];

    // TODO: possible to define this as a route in react-router, but without a corresponding
    //       React component?
    let jsonUrl = `/${orgId}/${projectId}/issues/${groupId}/events/${evt.id}/json/`;

    return (
      <div className="event-toolbar">
        <div className="pull-right">
          <div className="btn-group">
            {eventNavNodes}
          </div>
        </div>
        <h4>Event {evt.eventID}</h4>
        <span>
          <DateTime date={evt.dateCreated} />
          <a href={jsonUrl} target="_blank" className="json-link">JSON &#40;<FileSize bytes={evt.size} />&#41;</a>
        </span>
      </div>
    );
  }
});

export default GroupEventToolbar ;
