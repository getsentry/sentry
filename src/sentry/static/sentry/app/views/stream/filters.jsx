import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {PageHeader} from 'app/styles/organization';
import {analytics} from 'app/utils/analytics';
import {t} from 'app/locale';
import Feature from 'app/components/acl/feature';
import PageHeading from 'app/components/pageHeading';
import QueryCount from 'app/components/queryCount';
import SentryTypes from 'app/sentryTypes';

import OrganizationSavedSearchSelector from './organizationSavedSearchSelector';
import SavedSearchSelector from './savedSearchSelector';
import SearchBar from './searchBar';
import SortOptions from './sortOptions';

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

  handleOrganizationSavedSearchSelect = savedSearch => {
    analytics('organization_saved_search.selected', {
      org_id: this.props.organization.id,
      query: savedSearch.query,
      search_type: 'issues',
      id: savedSearch.id ? parseInt(savedSearch.id, 10) : -1,
    });

    if (this.props.onSavedSearchSelect) {
      this.props.onSavedSearchSelect(savedSearch);
    }
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
    const hasOrgSavedSearches = organization.features.includes('org-saved-searches');

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
        <SearchContainer isWide={hasOrgSavedSearches}>
          <SortOptions sort={sort} onSelect={onSortChange} />

          <Feature features={['org-saved-searches']}>
            <OrganizationSavedSearchSelector
              key={query}
              organization={organization}
              savedSearchList={savedSearchList}
              onSavedSearchSelect={this.handleOrganizationSavedSearchSelect}
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
            onSidebarToggle={onSidebarToggle}
          />
        </SearchContainer>
      </PageHeader>
    );
  }
}

const SearchContainer = styled.div`
  display: flex;
  width: ${p => (p.isWide ? '70%' : '58.3%')};
`;

export default StreamFilters;
