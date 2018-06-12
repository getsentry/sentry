import {Observer} from 'mobx-react';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Button from 'app/components/buttons/button';
import SavedSearchSelector from 'app/views/stream/savedSearchSelector';
import SearchBar from 'app/views/stream/searchBar';
import SortOptions from 'app/views/stream/sortOptions';

class StreamFilters extends React.Component {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    access: PropTypes.object.isRequired,

    searchId: PropTypes.string,
    savedSearchList: PropTypes.array.isRequired,

    sort: PropTypes.string,
    query: PropTypes.string,
    isSearchDisabled: PropTypes.bool,
    queryCount: PropTypes.number,
    queryMaxCount: PropTypes.number,

    onSortChange: PropTypes.func,
    onSearch: PropTypes.func,
    onSidebarToggle: PropTypes.func,
    onSavedSearchCreate: PropTypes.func.isRequired,
  };

  static contextTypes = {
    location: PropTypes.object,
  };

  static defaultProps = {
    sort: '',
    query: null,
    onSortChange: function() {},
    onSearch: function() {},
    onSidebarToggle: function() {},
  };

  render() {
    let {
      access,
      orgId,
      projectId,
      searchId,
      queryCount,
      queryMaxCount,
      query,
      savedSearchList,
      // isSearchDisabled,
      store,
      sort,

      onSidebarToggle,
      onSearch,
      onSavedSearchCreate,
      onSortChange,
    } = this.props;

    return (
      <div className="stream-header">
        <div className="row">
          <div className="col-sm-5">
            <SavedSearchSelector
              access={access}
              orgId={orgId}
              projectId={projectId}
              searchId={searchId}
              queryCount={queryCount}
              queryMaxCount={queryMaxCount}
              query={query}
              onSavedSearchCreate={onSavedSearchCreate}
              savedSearchList={savedSearchList}
            />
          </div>
          <div className="col-sm-7">
            <div className="search-container">
              <div className="stream-sort">
                <SortOptions sort={sort} onSelect={onSortChange} />
              </div>
              <Observer>
                {() => (
                  <React.Fragment>
                    <SearchBar
                      orgId={orgId}
                      projectId={projectId}
                      placeholder={t(
                        'Search for events, users, tags, and everything else.'
                      )}
                      query={query || ''}
                      onSearch={onSearch}
                      disabled={store.isStreamSidebarVisible}
                      excludeEnvironment={true}
                    />
                    <ToggleButton
                      size="small"
                      onClick={onSidebarToggle}
                      active={store.isStreamSidebarVisible}
                      priority={store.isStreamSidebarVisible ? 'primary' : 'default'}
                    >
                      <span className="icon-filter" />
                    </ToggleButton>
                  </React.Fragment>
                )}
              </Observer>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default StreamFilters;

const ToggleButton = styled(Button)`
  width: 50px;
  margin-left: 5px;
  height: 38px;
  text-align: center;

  &:focus,
  &:active {
    box-shadow: 0;
  }

  .icon-filter {
    font-size: 19px;
  }

  ${p =>
    p.active &&
    `
  box-shadow: inset 0 2px 0 rgba(0, 0, 0, 0.12);
  `};
`;
