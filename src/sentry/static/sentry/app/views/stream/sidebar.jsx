import React from "react";
import _ from "underscore";
import StreamTagFilter from "./tagFilter";

var StreamSidebar = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  getDefaultProps() {
    return {
      tags: {}
    };
  },

  componentWillMount() {
  },

  render() {
    return (
      <div className="stream-sidebar">
        {_.map(this.props.tags, (tag) => {
          return <StreamTagFilter tag={tag}/>;
        })}
      </div>
    );
  }
});

export default StreamSidebar;
