import PropTypes from 'prop-types';
import React from 'react';

import Feature from 'app/components/acl/feature';
import SentryTypes from 'app/sentryTypes';
import QueryCount from 'app/components/queryCount';
import {PageHeader} from 'app/styles/organization';
import PageHeading from 'app/components/pageHeading';
import {t} from 'app/locale';

import SearchBar from './searchBar';
import SortOptions from './sortOptions';
import SavedSearchSelector from './savedSearchSelector';
import OrganizationSavedSearchSelector from './organizationSavedSearchSelector';

class StreamFilters extends React.Component {
  static propTypes = {
    projectId: PropTypes.string,
    organization: SentryTypes.Organization,

    searchId: PropTypes.string,
    savedSearchList: PropTypes.arrayOf(SentryTypes.SavedSearch),
    savedSearch: SentryTypes.SavedSearch,

    sort: PropTypes.string,
    query: PropTypes.string,
    isSearchDisabled: PropTypes.bool,
    queryCount: PropTypes.number,
    queryMaxCount: PropTypes.number,

    onSortChange: PropTypes.func,
    onSearch: PropTypes.func,
    onSidebarToggle: PropTypes.func,
    onSavedSearchCreate: PropTypes.func.isRequired,
    onSavedSearchSelect: PropTypes.func.isRequired,
    onSavedSearchDelete: PropTypes.func.isRequired,
    tagValueLoader: PropTypes.func.isRequired,
    tags: PropTypes.object.isRequired,
  };

  static contextTypes = {
    location: PropTypes.object,
  };

  static defaultProps = {
    projectId: null,
    sort: '',
    query: null,
    onSortChange: function() {},
    onSearch: function() {},
    onSidebarToggle: function() {},
  };

  render() {
    const {
      organization,
      projectId,
      savedSearch,
      searchId,
      queryCount,
      queryMaxCount,
      query,
      savedSearchList,
      isSearchDisabled,
      sort,

      onSidebarToggle,
      onSearch,
      onSavedSearchCreate,
      onSavedSearchSelect,
      onSavedSearchDelete,
      onSortChange,
      tagValueLoader,
      tags,
    } = this.props;

    return (
      <PageHeader>
        <Feature
          features={['org-saved-searches']}
          renderDisabled={() => (
            <SavedSearchSelector
              organization={organization}
              projectId={projectId}
              searchId={searchId}
              queryCount={queryCount}
              queryMaxCount={queryMaxCount}
              query={query}
              onSavedSearchCreate={onSavedSearchCreate}
              onSavedSearchSelect={onSavedSearchSelect}
              savedSearchList={savedSearchList}
            />
          )}
        >
          <PageHeading>
            {t('Issues')}
            <QueryCount count={queryCount} max={queryMaxCount} />
          </PageHeading>
        </Feature>
        <div className="search-container">
          <SortOptions sort={sort} onSelect={onSortChange} />

          <Feature features={['org-saved-searches']}>
            <OrganizationSavedSearchSelector
              organization={organization}
              savedSearchList={savedSearchList}
              onSavedSearchCreate={onSavedSearchCreate}
              onSavedSearchSelect={onSavedSearchSelect}
              onSavedSearchDelete={onSavedSearchDelete}
              query={query}
            />
          </Feature>

          <SearchBar
            orgId={organization.slug}
            query={query || ''}
            onSearch={onSearch}
            disabled={isSearchDisabled}
            excludeEnvironment={true}
            supportedTags={tags}
            tagValueLoader={tagValueLoader}
            savedSearch={savedSearch}
          />
          <a className="btn btn-default toggle-stream-sidebar" onClick={onSidebarToggle}>
            <span className="icon-filter" />
          </a>
        </div>
      </PageHeader>
    );
  }
}

export default StreamFilters;
