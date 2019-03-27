import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import MenuItem from 'app/components/menuItem';
import DropdownLink from 'app/components/dropdownLink';
import QueryCount from 'app/components/queryCount';
import InlineSvg from 'app/components/inlineSvg';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';

export default class OrganizationSavedSearchSelector extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    savedSearchList: PropTypes.array.isRequired,
    onSavedSearchSelect: PropTypes.func.isRequired,
    onSavedSearchDelete: PropTypes.func.isRequired,
    query: PropTypes.string,
    queryCount: PropTypes.number,
    queryMaxCount: PropTypes.number,
    searchId: PropTypes.string,
  };

  getTitle() {
    const {searchId, query, savedSearchList} = this.props;
    let result;

    if (searchId) {
      result = savedSearchList.find(search => searchId === search.id);
    } else {
      result = savedSearchList.find(search => query === search.query);
    }

    return result ? result.name : t('Custom Search');
  }

  renderList() {
    const {
      savedSearchList,
      onSavedSearchDelete,
      onSavedSearchSelect,
      organization,
    } = this.props;

    if (savedSearchList.length === 0) {
      return <EmptyItem>{t("There don't seem to be any saved searches yet.")}</EmptyItem>;
    }

    return savedSearchList.map(search => (
      <StyledMenuItem onSelect={() => onSavedSearchSelect(search)} key={search.id}>
        {search.isPinned && <InlineSvg src={'icon-pin'} />}
        <SearchTitle>{search.name}</SearchTitle>
        <SearchQuery>{search.query}</SearchQuery>
        {search.isGlobal === false && (
          <Access
            organization={organization}
            access={['org:write']}
            renderNoAccessMessage={false}
          >
            <Confirm
              onConfirm={() => onSavedSearchDelete(search)}
              message={t('Are you sure you want to delete this saved search?')}
              stopPropagation
            >
              <Button
                title={t('Delete this saved search')}
                icon="icon-trash"
                size="xsmall"
              />
            </Confirm>
          </Access>
        )}
      </StyledMenuItem>
    ));
  }

  render() {
    const {queryCount, queryMaxCount} = this.props;

    return (
      <Container>
        <StyledDropdownLink
          title={
            <span>
              <span>{this.getTitle()}</span>
              <QueryCount count={queryCount} max={queryMaxCount} />
            </span>
          }
        >
          {this.renderList()}
        </StyledDropdownLink>
      </Container>
    );
  }
}

const Container = styled.div`
  & .dropdown-menu {
    max-width: 350px;
    min-width: 275px;
  }
`;

const SearchTitle = styled.strong`
  display: block;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  color: ${p => p.theme.gray5};
  padding: 0;
  background: inherit;
`;

const SearchQuery = styled.code`
  display: block;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  color: ${p => p.theme.gray5};
  padding: 0;
  background: inherit;
`;

const StyledMenuItem = styled(MenuItem)`
  position: relative;

  & a {
    /* override shared-components.less */
    padding: ${space(0.25)} ${space(1)} !important;
  }

  & button {
    display: none;
  }

  &:focus,
  &:hover button {
    display: block;
    position: absolute;
    top: ${space(0.5)};
    right: ${space(1)};
  }
`;

const StyledDropdownLink = styled(DropdownLink)`
  display: inline-block;
  font-size: 22px;
  color: ${p => p.theme.gray5};
  line-height: 36px;
  margin-right: 10px;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;

  & :hover,
  & :focus {
    color: ${p => p.theme.gray5};
  }

  & .icon-arrow-down {
    display: inline-block;
    margin-left: 5px;
    top: 0;
    vertical-align: middle;
  }
`;

const EmptyItem = styled.li`
  padding: 8px 10px 5px;
  font-style: italic;
`;
