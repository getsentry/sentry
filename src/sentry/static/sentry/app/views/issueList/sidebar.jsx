import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import isEqual from 'lodash/isEqual';
import debounce from 'lodash/debounce';
import map from 'lodash/map';
import styled from '@emotion/styled';

import LoadingIndicator from 'app/components/loadingIndicator';
import {IconClose} from 'app/icons/iconClose';
import {queryToObj, objToQuery} from 'app/utils/stream';
import {t} from 'app/locale';

import IssueListTagFilter from './tagFilter';

const TEXT_FILTER_DEBOUNCE_IN_MS = 300;

const IssueListSidebar = createReactClass({
  displayName: 'IssueListSidebar',

  propTypes: {
    orgId: PropTypes.string.isRequired,

    tags: PropTypes.object.isRequired,
    query: PropTypes.string,
    onQueryChange: PropTypes.func.isRequired,
    loading: PropTypes.bool,
    tagValueLoader: PropTypes.func.isRequired,
  },

  getDefaultProps() {
    return {
      tags: {},
      query: '',
      onQueryChange: function() {},
    };
  },

  getInitialState() {
    const queryObj = queryToObj(this.props.query);
    return {
      queryObj,
      textFilter: queryObj.__text,
    };
  },

  componentWillReceiveProps(nextProps) {
    // If query was updated by another source (e.g. SearchBar),
    // clobber state of sidebar with new query.
    const query = objToQuery(this.state.queryObj);

    if (!isEqual(nextProps.query, query)) {
      const queryObj = queryToObj(nextProps.query);
      this.setState({
        queryObj,
        textFilter: queryObj.__text,
      });
    }
  },

  onSelectTag(tag, value) {
    const newQuery = {...this.state.queryObj};
    if (value) {
      newQuery[tag.key] = value;
    } else {
      delete newQuery[tag.key];
    }

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

  debouncedTextChange: debounce(function(text) {
    this.setState(
      {
        queryObj: {...this.state.queryObj, __text: text},
      },
      this.onQueryChange
    );
  }, TEXT_FILTER_DEBOUNCE_IN_MS),

  onTextFilterSubmit(evt) {
    evt && evt.preventDefault();

    const newQueryObj = {
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
    const query = objToQuery(this.state.queryObj);
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
    const {loading, orgId, tagValueLoader, tags} = this.props;
    return (
      <div className="stream-sidebar">
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
                  <StyledIconClose size="xs" onClick={this.onClearSearch} />
                )}
              </form>
              <hr />
            </div>

            {map(tags, tag => (
              <IssueListTagFilter
                value={this.state.queryObj[tag.key]}
                key={tag.key}
                tag={tag}
                onSelect={this.onSelectTag}
                orgId={orgId}
                tagValueLoader={tagValueLoader}
              />
            ))}
          </div>
        )}
      </div>
    );
  },
});

const StyledIconClose = styled(IconClose)`
  cursor: pointer;
  position: absolute;
  top: 13px;
  right: 10px;
  color: ${p => p.theme.gray400};

  &:hover {
    color: ${p => p.theme.gray500};
  }
`;

export default IssueListSidebar;
