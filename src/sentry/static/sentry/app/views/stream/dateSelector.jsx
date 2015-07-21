var PureRenderMixin = require('react/addons').addons.PureRenderMixin;
var React = require("react");

var DateTimeField = require("../../modules/datepicker/DateTimeField");

var DateSelector = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [
    PureRenderMixin
  ],

  getInitialState() {
    var dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 3);
    return {
      dateFrom: dateFrom.getTime() / 1000,
      dateTo: null,
      dateType: "last_seen"
    };
  },

  onClear(e) {
    this.setState({
      dateFrom: null,
      dateTo: null
    });
    this.onApply(e);
  },

  onDateFromChange(value) {
    this.setState({
      dateFrom: value
    });
  },

  onDateToChange(value) {
    this.setState({
      dateTo: value
    });
  },

  onDateTypeChange(value) {
    this.setState({
      dateType: value
    });
  },

  onApply(e) {
    e.preventDefault();
    var router = this.context.router;
    var queryParams = router.getCurrentQuery();
    queryParams.until = this.state.dateTo;
    queryParams.since = this.state.dateFrom;
    queryParams.date_type = this.state.dateType;
    // TODO(dcramer): ideally we wouldn't hardcode stream here
    router.transitionTo('stream', router.getCurrentParams(), queryParams);
  },

  render() {
    return (
      <div className="dropdown btn-group">
        <a ref="toggle" className="btn btn-sm dropdown-toggle hidden-xs" data-toggle="dropdown">
          All time
          <span className="icon-arrow-down"></span>
        </a>
        <div className="datepicker-box dropdown-menu" id="daterange">
          <form method="GET">
            <div className="input">
              <DateTimeField dateTime={this.state.dateFrom} onChange={this.onDateFromChange} />
              to
              <DateTimeField dateTime={this.state.dateTo} onChange={this.onDateToChange} />
              <div className="help-block">All events are represented in UTC time.</div>
            </div>
            <div className="submit">
              <div className="pull-right">
                <button className="btn btn-default btn-sm" onClick={this.onClear}>Clear</button>
                <button className="btn btn-primary btn-sm" onClick={this.onApply}>Apply</button>
              </div>
              <div className="radio-inputs">
                <label className="radio">
                  <input type="radio" name="date_type"
                    onChange={this.onDateTypeChange.bind(this, "last_seen")}
                    checked={this.state.dateType === "last_seen"} /> Last Seen
                </label>
                <label className="radio">
                  <input type="radio" name="date_type"
                    onChange={this.onDateTypeChange.bind(this, "first_seen")}
                    checked={this.state.dateType === "first_seen"} /> First Seen
                </label>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }
});

module.exports = DateSelector;
