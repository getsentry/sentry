import React from "react";
import _ from "underscore";
import StreamTagFilter from "./tagFilter";

var StreamSidebar = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  propTypes: {
    tags: React.PropTypes.object.isRequired,
    onQueryChange: React.PropTypes.func.isRequired
  },

  getDefaultProps() {
    return {
      tags: {},
      onQueryChange: function () {}
    };
  },

  getInitialState() {
    return {
      activeTagValues: {},
    };
  },

  buildQuery() {
    return _.map(this.state.activeTagValues, (value, tagKey) => {
      return `${tagKey}:${value}`;
    }).join(' ');
  },

  onSelectTag(tag, value) {
    this.setState({
      activeTagValues: {...this.state.activeTagValues, [tag.key]:value}
    }, () => {
      let query = this.buildQuery();
      console.log(query);
      this.props.onQueryChange && this.props.onQueryChange(query);
    });
  },

  render() {
    return (
      <div className="stream-sidebar">
        {_.map(this.props.tags, (tag) => {
          return (
            <StreamTagFilter
              key={tag.key}
              tag={tag}
              onSelect={this.onSelectTag}
            />
          );
        })}
      </div>
    );
  }
});

export default StreamSidebar;
