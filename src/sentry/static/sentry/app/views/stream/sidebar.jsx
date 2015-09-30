import React from "react";
import _ from "underscore";
import StreamTagFilter from "./tagFilter";
import {queryToObj, objToQuery} from "../../utils/stream";


let TEXT_FILTER_DEBOUNCE_IN_MS = 300;

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
    // If query was updated by another source (e.g. SearchBar),
    // clobber state of sidebar with new query.
    let query = objToQuery(this.state.queryObj);

    if (!_.isEqual(nextProps.query, query)) {
      let queryObj = queryToObj(nextProps.query);
      this.setState({
        queryObj: queryObj,
        textFilter: queryObj.__text
      });
    }
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

    this.setState({ textFilter: text });

    this.debouncedTextChange(text);
  },

  debouncedTextChange: _.debounce(function(text) {
    this.setState({
      queryObj: {...this.state.queryObj, __text:text}
    }, this.onQueryChange);
  }, TEXT_FILTER_DEBOUNCE_IN_MS),

  onQueryChange() {
    let query = objToQuery(this.state.queryObj);
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
