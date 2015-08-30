var PureRenderMixin = require('react/addons').addons.PureRenderMixin;
import React from "react";
import DateTimeInput from "../../components/dateTimeInput";
import Modal from "react-bootstrap/Modal";
import OverlayMixin from "react-bootstrap/OverlayMixin";

var CustomDateRange = React.createClass({
  mixins: [OverlayMixin, PureRenderMixin],

  getInitialState() {
    return {
      isModalOpen: false,
      dateFrom: this.props.dateFrom,
      dateTo: this.props.dateTo,
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
      <Modal title="Custom Date Range" animation={false} onRequestHide={this.onToggle} className="datepicker-modal">
        <div className="modal-body">
          <div className="datepicker-box">
            <div className="row">
              <div className="col-md-6">
                <h6>Start (UTC)</h6>
                <DateTimeInput dateTime={this.state.dateFrom} onChange={this.onDateFromChange} />
              </div>
              <div className="col-md-6">
                <h6>End (UTC)</h6>
                <DateTimeInput dateTime={this.state.dateTo} onChange={this.onDateToChange} />
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <div className="radio-inputs pull-left">
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
          <button type="button" className="btn btn-default"
                  onClick={this.onToggle}>Close</button>
          <button type="button" className="btn btn-primary"
                  onClick={this.onApply}>Apply</button>
        </div>
      </Modal>
    );
  }
});

export default CustomDateRange;