import React from "react";
import moment from "moment";
import ConfigStore from "../stores/configStore.jsx";

const DateTime = React.createClass({
  propTypes: {
    date: React.PropTypes.any.isRequired
  },

  render() {
    let date = this.props.date;
    let user = ConfigStore.get('user');
    let options = user ? user.options : {};
    let format = options.clock24Hours ? 'MMMM D YYYY HH:mm:ss z' : 'LLL z';

    if (typeof date === "string" || typeof date === "number") {
      date = new Date(date);
    }

    return (
      <time>{moment(date).format(format)}</time>
    );
  }
});

export default DateTime;

