var PureRenderMixin = require('react/addons').addons.PureRenderMixin;
import React from "react";
import DropdownLink from "../../components/dropdownLink";
import MenuItem from "../../components/menuItem";

import CustomDateRange from "./customDateRange";

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
          btnGroup={true}
          title="Since: All time">
        <MenuItem>All Time</MenuItem>
        <MenuItem noAnchor={true}>
          <CustomDateRange
            dateFrom={this.state.dateFrom}
            dateTo={this.state.dateTo} />
        </MenuItem>
      </DropdownLink>
    );
  }
});

export default DateSelector;

