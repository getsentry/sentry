import React from "react";
import $ from "jquery";
import MD5 from "crypto-js/md5";

var Gravatar = React.createClass({
  propTypes: {
    email: React.PropTypes.string,
    size: React.PropTypes.number,
    default: React.PropTypes.string
  },

  getDefaultProps() {
    return {
      size: 64
    };
  },

  buildGravatarUrl() {
    var url = "https://secure.gravatar.com/avatar/";

    url += MD5(this.props.email.toLowerCase());

    var query = {
      s: this.props.size || undefined,
      d: this.props.default || undefined
    };

    url += "?" + $.param(query);

    return url;
  },

  render() {
    if (!this.props.email) {
      // TODO(dcramer): return placeholder image
      return null;
    }

    return (
      <img src={this.buildGravatarUrl()} className="avatar"/>
    );
  }
});

export default Gravatar;

