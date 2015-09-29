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
    let tags = _.omit(this.state.currentQuery, '__text');

    return _.map(tags, (value, tagKey) => {
        return `${tagKey}:"${value}"`;
      })
      .concat(this.state.currentQuery.__text)
      .join(' ');
  },

  onSelectTag(tag, value) {
    this.setState({
      currentQuery: {...this.state.currentQuery, [tag.key]:value}
    }, this.onQueryChange);
  },

  onTextChange: function (evt) {
    let text = evt.target.value;

    this.debouncedTextChange(text);
  },

  debouncedTextChange: _.debounce(function(text) {
    this.setState({
      currentQuery: {...this.state.currentQuery, __text:text}
    }, this.onQueryChange);
  }, 300),

  onQueryChange() {
    let query = this.getQueryStr();
    this.props.onQueryChange && this.props.onQueryChange(query);
  },

  render() {
    return (
      <div className="stream-sidebar">
        <div className="stream-tag-filter">
          <h6 className="nav-header">Text</h6>
          <input
            className="form-control"
            placeholder="Search title and culprit text body"
            onChange={this.onTextChange}
            defaultValue={this.props.initialQuery.__text}
          />
        </div>

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
