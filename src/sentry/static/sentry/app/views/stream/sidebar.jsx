import React from "react";
import _ from "underscore";
import StreamTagFilter from "./tagFilter";
import {queryToObj} from "../../utils/stream";


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
      query: '',
      onQueryChange: function () {}
    };
  },

  getInitialState() {
    let queryObj = queryToObj(this.props.query);
    return {
      queryObj: queryObj,
      textFilter: queryObj.__text
    };
  },

  componentWillReceiveProps(nextProps) {
    // query was updated by another source (e.g. sidebar filters)
    let query = this.getQueryStr();

    if (!_.isEqual(nextProps.query, query)) {
      let queryObj = queryToObj(nextProps.query);
      this.setState({
        queryObj: queryObj,
        textFilter: queryObj.__text
      });
    }
  },

  getQueryStr() {
    let tags = _.omit(this.state.queryObj, '__text');

    return _.map(tags, (value, tagKey) => {
        if (value.indexOf(' ') > -1)
          value = `"${value}"`;

        return `${tagKey}:${value}`;
      })
      .concat(this.state.queryObj.__text)
      .join(' ');
  },

  onSelectTag(tag, value) {
    let newQuery = {...this.state.queryObj};
    if (value)
      newQuery[tag.key] = value;
    else
      delete newQuery[tag.key];

    this.setState({
      queryObj: newQuery,
    }, this.onQueryChange);
  },

  onTextChange: function (evt) {
    let text = evt.target.value;

    this.setState({
      textFilter: text
    });

    this.debouncedTextChange(text);
  },

  debouncedTextChange: _.debounce(function(text) {
    this.setState({
      queryObj: {...this.state.queryObj, __text:text}
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
            value={this.state.textFilter}
          />
          <hr/>
        </div>

        {_.map(this.props.tags, (tag) => {
          return (
            <StreamTagFilter
              value={this.state.queryObj[tag.key]}
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
