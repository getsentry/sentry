/*** @jsx React.DOM */
var React = require("react");

var StreamActions = React.createClass({
  render: function() {
    return (
      <div className="stream-actions">
        <div className="stream-actions-left stream-actions-cell">
          <div className="checkbox">
            <input type="checkbox" className="chk-select-all"/>
          </div>
          <div className="btn-group">
            <a href="javascript:void(0)" className="btn btn-default btn-sm action action-resolve">
                <i aria-hidden="true" className="icon-checkmark"></i>
            </a>
            <a href="javascript:void(0)" className="btn btn-default btn-sm action action-bookmark">
                <span className="icon icon-bookmark"></span>
            </a>
            <a className="btn btn-default btn-sm hidden-xs action action-more dropdown-toggle" data-toggle="dropdown">
              <span className="icon-ellipsis"></span>
            </a>

            <ul className="dropdown-menu more-menu">
              <li><a href="javascript:void(0)" className="action action-merge">Merge Events</a></li>
              <li><a href="javascript:void(0)" className="action action-remove-bookmark">Remove from Bookmarks</a></li>
              <li className="divider"></li>
              <li><a href="javascript:void(0)" className="action action-delete">Delete Events</a></li>
            </ul>
          </div>

          <div className="btn-group">
            <a href="javascript:void(0)" className="btn btn-default btn-sm hidden-xs realtime-control">
              <span className="icon icon-pause"></span>
            </a>
          </div>
          <div className="btn-group">
            <a href="#" className="btn dropdown-toggle btn-sm" data-toggle="dropdown">
              <span className="hidden-sm hidden-xs">Sort by:</span> sortLabel
              <span aria-hidden="true" className="icon-arrow-down"></span>
            </a>
            <ul className="dropdown-menu">
              <li className="active"><a href="?sort=priority">Priority</a></li>
              <li><a href="?sort=date">Last Seen</a></li>
              <li><a href="?sort=new">First Seen</a></li>
              <li><a href="?sort=freq">Frequency</a></li>
            </ul>
          </div>
          <div className="btn-group">
            <a href="#" className="btn dropdown-toggle btn-sm" onclick="" data-toggle="dropdown">
              All time
            <span aria-hidden="true" className="icon-arrow-down"></span></a>
            <div className="datepicker-box dropdown-menu" id="daterange">
              <form method="GET" action=".">
                <div className="input">
                  <div className="inline-inputs">
                    <input data-toggle="datepicker" data-date-format="yyyy-mm-dd"name="df" className="form-control date" type="text" placeholder="Date" />
                    <input className="time form-control" type="text" name="tf" placeholder="Time" />
                    to
                    <input data-toggle="datepicker" data-date-format="yyyy-mm-dd" name="dt" className="date form-control" type="text" placeholder="Date"/>
                    <input className="time form-control" type="text" name="tt" placeholder="Time" />
                  </div>
                  <div className="help-block">All events are represented in UTC time.</div>
                </div>
                <div className="submit">
                  <div className="pull-right">
                    <button className="btn btn-default btn-sm">Clear</button>
                    <button className="btn btn-primary btn-sm">Apply</button>
                  </div>
                  <div className="radio-inputs">
                    <label className="radio">
                      <input type="radio" name="date_type" value="last_seen" /> Last Seen
                    </label>
                    <label className="radio">
                      <input type="radio" name="date_type" value="first_seen" /> First Seen
                    </label>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
        <div className="hidden-sm hidden-xs stream-actions-assignee stream-actions-cell">
        </div>
        <div className="hidden-sm hidden-xs stream-actions-graph stream-actions-cell">
          <ul className="toggle-graph">
            <li><a>24h</a></li>
            <li><a>30d</a></li>
          </ul>
        </div>
        <div className="stream-actions-occurrences stream-actions-cell align-center hidden-xs"> events</div>
        <div className="stream-actions-users stream-actions-cell align-center hidden-xs"> users</div>
      </div>
    );
  }
});

module.exports = StreamActions
