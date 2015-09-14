import Router from "react-router";
import React from "react";
import PropTypes from "../../proptypes";
import DateTime from "../../components/dateTime";
import FileSize from "../../components/fileSize";

var GroupEventToolbar  = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
  },

  render() {
    let evt = this.props.event;

    let params = {
      orgId: this.props.orgId,
      projectId: this.props.projectId,
      groupId: this.props.group.id
    };

    let eventNavNodes = [
      (evt.previousEventID ?
        <Router.Link
            key="oldest"
            to="groupEventDetails"
            params={Object.assign({}, params, {
              eventId: 'oldest'
            })}
            className="btn btn-default"
            title="Oldest">
            <span className="icon-skip-back"></span>
        </Router.Link>
      :
        <a key="oldest"
          className="btn btn-default disabled"><span className="icon-skip-back"></span></a>
      ),
      (evt.previousEventID ?
        <Router.Link
            key="prev"
            to="groupEventDetails"
            params={Object.assign({}, params, {
              eventId: evt.previousEventID
             })}
            className="btn btn-default">Older</Router.Link>
      :
        <a key="prev"
           className="btn btn-default disabled">Older</a>
      ),
      (evt.nextEventID ?
        <Router.Link
            key="next"
            to="groupEventDetails"
            params={Object.assign({}, params, {
              eventId: evt.nextEventID
            })}
            className="btn btn-default">Newer</Router.Link>
      :
        <a key="next"
           className="btn btn-default disabled">Newer</a>
      ),
      (evt.nextEventID ?
        <Router.Link
          key="latest"
          to="groupEventDetails"
          params={Object.assign({}, params, {
            eventId: 'latest'
          })}
          className="btn btn-default"
          title="Newest">
          <span className="icon-skip-forward"></span>
        </Router.Link>
      :
        <a key="latest"
          className="btn btn-default disabled"><span className="icon-skip-forward"></span></a>
      )
    ];

    return (
      <div className="event-toolbar">
        <div className="pull-right">
          <div className="btn-group">
            {eventNavNodes}
          </div>
        </div>
        <h4>Event <small>{evt.eventID}</small></h4>
        <span><DateTime date={evt.dateCreated} /> &#40;<FileSize bytes={evt.size} />&#41;</span>
      </div>
    );
  }
});

export default GroupEventToolbar ;
