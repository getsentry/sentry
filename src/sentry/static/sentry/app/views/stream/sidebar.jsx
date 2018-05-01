import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import _ from 'lodash';
import StreamTagFilter from 'app/views/stream/tagFilter';
import LoadingIndicator from 'app/components/loadingIndicator';
import {queryToObj, objToQuery} from 'app/utils/stream';
import {t} from 'app/locale';

let TEXT_FILTER_DEBOUNCE_IN_MS = 300;

const StreamSidebar = createReactClass({
  displayName: 'StreamSidebar',

  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,

    tags: PropTypes.object.isRequired,
    query: PropTypes.string,
    onQueryChange: PropTypes.func.isRequired,
    loading: PropTypes.bool,
  },

  getDefaultProps() {
    return {
      tags: {},
      query: '',
      onQueryChange: function() {},
    };
  },

  getInitialState() {
    let queryObj = queryToObj(this.props.query);
    return {
      queryObj,
      textFilter: queryObj.__text,
    };
  },

  componentWillReceiveProps(nextProps) {
    // If query was updated by another source (e.g. SearchBar),
    // clobber state of sidebar with new query.
    let query = objToQuery(this.state.queryObj);

    if (!_.isEqual(nextProps.query, query)) {
      let queryObj = queryToObj(nextProps.query);
      this.setState({
        queryObj,
        textFilter: queryObj.__text,
      });
    }
  },

  onSelectTag(tag, value) {
    let newQuery = {...this.state.queryObj};
    if (value) newQuery[tag.key] = value;
    else delete newQuery[tag.key];

    this.setState(
      {
        queryObj: newQuery,
      },
      this.onQueryChange
    );
  },

  onTextChange: function(evt) {
    this.setState({textFilter: evt.target.value});
  },

  debouncedTextChange: _.debounce(function(text) {
    this.setState(
      {
        queryObj: {...this.state.queryObj, __text: text},
      },
      this.onQueryChange
    );
  }, TEXT_FILTER_DEBOUNCE_IN_MS),

  onTextFilterSubmit(evt) {
    evt && evt.preventDefault();

    let newQueryObj = {
      ...this.state.queryObj,
      __text: this.state.textFilter,
    };

    this.setState(
      {
        queryObj: newQueryObj,
      },
      this.onQueryChange
    );
  },

  onQueryChange() {
    let query = objToQuery(this.state.queryObj);
    this.props.onQueryChange && this.props.onQueryChange(query);
  },

  onClearSearch() {
    this.setState(
      {
        textFilter: '',
      },
      this.onTextFilterSubmit
    );
  },

  render() {
    return (
      <div className="stream-sidebar">
        {this.props.loading ? (
          <LoadingIndicator />
        ) : (
          <div>
            <div className="stream-tag-filter">
              <h6 className="nav-header">{t('Text')}</h6>
              <form onSubmit={this.onTextFilterSubmit}>
                <input
                  className="form-control"
                  placeholder={t('Search title and culprit text body')}
                  onChange={this.onTextChange}
                  value={this.state.textFilter}
                />
                {this.state.textFilter && (
                  <a className="search-clear-form" onClick={this.onClearSearch}>
                    <span className="icon-circle-cross" />
                  </a>
                )}
              </form>
              <hr />
            </div>

            {_.map(this.props.tags, tag => {
              return (
                <StreamTagFilter
                  value={this.state.queryObj[tag.key]}
                  key={tag.key}
                  tag={tag}
                  onSelect={this.onSelectTag}
                  orgId={this.props.orgId}
                  projectId={this.props.projectId}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  },
});

export default StreamSidebar;
