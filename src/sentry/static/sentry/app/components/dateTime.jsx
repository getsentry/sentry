import React from "react";
import moment from "moment";

const DateTime = React.createClass({
  propTypes: {
    date: React.PropTypes.any.isRequired
  },

  render() {
    let date = this.props.date;

    if (typeof date === "string" || typeof date === "number") {
      date = new Date(date);
    }

    return (
      <time>{moment(date).format('LLL z')}</time>
    );
  }
});

export default DateTime;

