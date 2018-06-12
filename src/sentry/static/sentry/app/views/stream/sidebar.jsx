import {Observer} from 'mobx-react';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import _ from 'lodash';
import styled from 'react-emotion';

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
    store: PropTypes.object,
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
    let {loading, orgId, projectId, tags, store} = this.props;
    return (
      <Observer>
        {() => (
          <StyledStreamSidebar visible={store.isStreamSidebarVisible}>
            {loading ? (
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

                {_.map(tags, tag => {
                  return (
                    <StreamTagFilter
                      value={this.state.queryObj[tag.key]}
                      key={tag.key}
                      tag={tag}
                      onSelect={this.onSelectTag}
                      orgId={orgId}
                      projectId={projectId}
                    />
                  );
                })}
              </div>
            )}
          </StyledStreamSidebar>
        )}
      </Observer>
    );
  },
});

export default StreamSidebar;

const StyledStreamSidebar = styled('div')`
  padding-left: 20px;
  width: 0;
  height: 0;
  overflow: hidden;
  visibility: hidden;
  opacity: 0;

  .stream-tag-filter {
    margin-bottom: 1em;

    form {
      position: relative;
    }
  }

  h6 {
    color: lighten(@gray, 10);
    margin-bottom: 10px;
  }

  .select2-container {
    width: 100%;
    max-width: 100%;
    padding: 6px 12px;
  }

  ${p =>
    p.visible &&
    `
      width: 25%;
      visibility: visible;
      opacity: 1;
      height: auto;
      overflow: visible;
      `};
`;
