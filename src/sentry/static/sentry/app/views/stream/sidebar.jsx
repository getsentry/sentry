import React from "react";
import _ from "underscore";
import StreamTagFilter from "./tagFilter";

var StreamSidebar = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  propTypes: {
    tags: React.PropTypes.object.isRequired,
    onQueryChange: React.PropTypes.func.isRequired,
    defaultQuery: React.PropTypes.string
  },

  getDefaultProps() {
    return {
      tags: {},
      onQueryChange: function () {},
      initialQuery: {}
    };
  },

  getInitialState() {
    return {
      currentQuery: this.props.initialQuery
    };
  },

  getQueryStr() {
    return _.map(this.state.currentQuery, (value, tagKey) => {
      return `${tagKey}:"${value}"`;
    }).join(' ');
  },

  onSelectTag(tag, value) {
    this.setState({
      currentQuery: {...this.state.currentQuery, [tag.key]:value}
    }, () => {
      let query = this.getQueryStr();
      this.props.onQueryChange && this.props.onQueryChange(query);
    });
  },

  render() {
    return (
      <div className="stream-sidebar">
        {_.map(this.props.tags, (tag) => {
          return (
            <StreamTagFilter
              initialValue={this.state.currentQuery[tag.key]}
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
