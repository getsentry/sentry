var PureRenderMixin = require('react/addons').addons.PureRenderMixin;
var React = require("react");

var DateTimeInput = require("../../components/dateTimeInput");
var DropdownLink = require("../../components/dropdownLink");
var MenuItem = require("../../components/menuItem");
var Modal = require("react-bootstrap/Modal");
var OverlayMixin = require("react-bootstrap/OverlayMixin");

var CustomDateRange = React.createClass({
  mixins: [OverlayMixin, PureRenderMixin],

  getInitialState() {
    return {
      isModalOpen: false,
      dateFrom: '',
      dateTo: '',
      dateType: 'last_seen'
    };
  },

  onApply(e) {
    this.onToggle(e);
  },

  onToggle(e) {
    this.setState({
      isModalOpen: !this.state.isModalOpen
    });
  },

  onDateTypeChange(e) {

  },

  onDateFromChange(e) {

  },

  onDateToChange(e) {

  },

  render() {
    return (
      <a className={this.props.className} onClick={this.onToggle}>
        Custom Range
      </a>
    );
  },

  renderOverlay() {
    if (!this.state.isModalOpen) {
      return null;
    }
    return (
      <Modal title="Custom Date Range" animation={false} onRequestHide={this.onToggle}>
        <div className="modal-body">
          <div className="datepicker-box">
            <div className="input">
              <DateTimeInput dateTime={this.state.dateFrom} onChange={this.onDateFromChange} />
              to
              <DateTimeInput dateTime={this.state.dateTo} onChange={this.onDateToChange} />
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
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-small btn-primary"
                  onClick={this.onApply}>Apply</button>
          <button type="button" className="btn btn-small"
                  onClick={this.onToggle}>Close</button>
        </div>
      </Modal>
    );
  }
});

var DateSelector = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [
    PureRenderMixin
  ],

  getInitialState() {
    return {
      dateFrom: this.props.defaultDateFrom,
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
      <DropdownLink
          className="btn btn-sm"
          btnGroup={true}
          title="Since: All time">
        <MenuItem>All Time</MenuItem>
        <MenuItem noAnchor={true}>
          <CustomDateRange />
        </MenuItem>
      </DropdownLink>
    );
  }
});

module.exports = DateSelector;
