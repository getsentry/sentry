var React = require("react");

var moment = require("moment");
var FileSize = require("../../components/fileSize");
var PropTypes = require("../../proptypes");

var GroupEventHeader = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired
  },

  render: function() {
    var event = this.props.event;

    if (!event) {
      return null;
    }

    // TODO(dcramer): put this at the overview level

    return (
      <div className="btn-toolbar hide">
        <a className="btn btn-default btn-lg pull-left prev">
          <span className="icon-arrow-left"></span> Newer Sample
        </a>
        <a className="btn btn-default btn-lg pull-right next">
          Older Sample <span className="icon-arrow-right"></span>
        </a>
        <h4>
          <time>{moment.utc(event.dateCreated).format('lll')}</time>
          <span>[<FileSize bytes={event.size} />]</span>
          <div>
            <small>ID: {event.eventID}</small>
          </div>
        </h4>
      </div>
    );
  }
});

module.exports = GroupEventHeader;
