import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import LoadingIndicator from 'app/components/loadingIndicator';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

import {SearchGroup, SearchItem} from './types';

type Props = {
  className?: string;
  items: SearchGroup[];
  searchSubstring: string;
  onClick: (value: string, item: SearchItem) => void;
  loading: boolean;
};

class SearchDropdown extends React.PureComponent<Props> {
  static defaultProps = {
    searchSubstring: '',
    onClick: function() {},
  };

  renderDescription = (item: SearchItem) => {
    const searchSubstring = this.props.searchSubstring;
    if (!searchSubstring) {
      return item.desc;
    }

    const text = item.desc;

    if (!text) {
      return null;
    }

    const idx = text.toLowerCase().indexOf(searchSubstring.toLowerCase());

    if (idx === -1) {
      return item.desc;
    }

    return (
      <span>
        {text.substr(0, idx)}
        <strong>{text.substr(idx, searchSubstring.length)}</strong>
        {text.substr(idx + searchSubstring.length)}
      </span>
    );
  };

  renderHeaderItem = (item: SearchGroup) => (
    <SearchDropdownGroup key={item.title}>
      <SearchDropdownGroupTitle>
        {item.icon}
        {item.title && item.title}
        {item.desc && <span>{item.desc}</span>}
      </SearchDropdownGroupTitle>
    </SearchDropdownGroup>
  );

  renderItem = (item: SearchItem) => (
    <SearchListItem
      key={item.value || item.desc}
      className={item.active ? 'active' : undefined}
      data-test-id="search-autocomplete-item"
      onClick={this.props.onClick.bind(this, item.value, item)}
      ref={element => item.active && element?.scrollIntoView?.({block: 'nearest'})}
    >
      <SearchItemTitleWrapper>
        {item.title && item.title + ' · '}
        <Description>{this.renderDescription(item)}</Description>
      </SearchItemTitleWrapper>
    </SearchListItem>
  );

  render() {
    const {className, loading, items} = this.props;
    return (
      <StyledSearchDropdown className={className}>
        {loading ? (
          <LoadingWrapper key="loading" data-test-id="search-autocomplete-loading">
            <LoadingIndicator mini />
          </LoadingWrapper>
        ) : (
          <SearchItemsList>
            {items.map(item => {
              const isEmpty = item.children && !item.children.length;
              const invalidTag = item.type === 'invalid-tag';

              // Hide header if `item.children` is defined, an array, and is empty
              return (
                <React.Fragment key={item.title}>
                  {invalidTag && <Info>{t('Invalid tag')}</Info>}
                  {item.type === 'header' && this.renderHeaderItem(item)}
                  {item.children && item.children.map(this.renderItem)}
                  {isEmpty && !invalidTag && <Info>{t('No items found')}</Info>}
                </React.Fragment>
              );
            })}
          </SearchItemsList>
        )}
      </StyledSearchDropdown>
    );
  }
}

export default SearchDropdown;

const StyledSearchDropdown = styled('div')`
  box-shadow: ${p => p.theme.dropShadowLight};
  border: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.borderRadiusBottom};
  position: absolute;
  top: 38px;
  /* Container has a border that we need to account for */
  right: -1px;
  left: -1px;
  background: #fff;
  z-index: ${p => p.theme.zIndex.dropdown};
  overflow: hidden;
`;

const LoadingWrapper = styled('div')`
  display: flex;
  justify-content: center;
  padding: ${space(1)};
`;

const Info = styled('div')`
  display: flex;
  padding: ${space(1)} ${space(2)};
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.gray500};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.borderLight};
  }
`;

const ListItem = styled('li')`
  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.borderLight};
  }
`;

const SearchDropdownGroup = styled(ListItem)``;

const SearchDropdownGroupTitle = styled('header')`
  display: flex;
  align-items: center;

  background-color: ${p => p.theme.gray100};
  color: ${p => p.theme.gray500};
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeMedium};

  margin: 0;
  padding: ${space(1)} ${space(2)};

  & > svg {
    margin-right: ${space(1)};
  }
`;

const SearchItemsList = styled('ul')`
  padding-left: 0;
  list-style: none;
  margin-bottom: 0;
`;

const SearchListItem = styled(ListItem)`
  scroll-margin: 40px 0;
  font-size: ${p => p.theme.fontSizeLarge};
  padding: ${space(1)} ${space(2)};
  cursor: pointer;

  &:hover,
  &.active {
    background: ${p => p.theme.gray100};
  }
`;

const SearchItemTitleWrapper = styled('div')`
  color: ${p => p.theme.textColor};
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
  line-height: ${p => p.theme.text.lineHeightHeading};
  ${overflowEllipsis};
`;

const Description = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-family: ${p => p.theme.text.familyMono};
`;
