import React from 'react';
import keydown from 'react-keydown';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {IconSearch} from 'app/icons';
import Search from 'app/components/search';

const MIN_SEARCH_LENGTH = 1;
const MAX_RESULTS = 10;

type Props = React.ComponentProps<typeof Search>;

class SettingsSearch extends React.Component<Props> {
  searchInput = React.createRef<HTMLInputElement>();

  @keydown('/')
  handleFocusSearch(e: React.FormEvent<HTMLInputElement>) {
    if (!this.searchInput.current) {
      return;
    }
    if (e.target === this.searchInput.current) {
      return;
    }

    e.preventDefault();
    this.searchInput.current.focus();
  }

  render() {
    return (
      <Search
        {...this.props}
        entryPoint="settings_search"
        minSearch={MIN_SEARCH_LENGTH}
        maxResults={MAX_RESULTS}
        renderInput={({getInputProps}) => (
          <SearchInputWrapper>
            <SearchInputIcon size="14px" />
            <SearchInput
              {...getInputProps({
                type: 'text',
                placeholder: t('Search'),
              })}
              ref={this.searchInput}
            />
          </SearchInputWrapper>
        )}
      />
    );
  }
}

// This is so we can use this as a selector for emotion
const StyledSettingsSearch = styled(SettingsSearch)``;

export default StyledSettingsSearch;
export {SettingsSearch};

const SearchInputWrapper = styled('div')`
  position: relative;
`;

const SearchInputIcon = styled(IconSearch)`
  color: ${p => p.theme.gray500};
  position: absolute;
  left: 10px;
  top: 8px;
`;

const SearchInput = styled('input')`
  transition: border-color 0.15s ease;
  font-size: 14px;
  width: 260px;
  line-height: 1;
  padding: 5px 8px 4px 28px;
  border: 1px solid ${p => p.theme.borderDark};
  border-radius: 30px;
  height: 28px;

  box-shadow: inset ${p => p.theme.dropShadowLight};

  &:focus {
    outline: none;
    border: 1px solid ${p => p.theme.borderDark};
  }

  &::placeholder {
    color: ${p => p.theme.gray500};
  }
`;
