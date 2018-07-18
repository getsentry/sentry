import React from 'react';
import keydown from 'react-keydown';
import styled from 'react-emotion';

import {t} from 'app/locale';
import InlineSvg from 'app/components/inlineSvg';
import Search from 'app/components/search';

const MIN_SEARCH_LENGTH = 1;
const MAX_RESULTS = 10;

class SettingsSearch extends React.Component {
  @keydown('/')
  handleFocusSearch(e) {
    if (!this.searchInput) return;
    if (e.target === this.searchInput) return;

    e.preventDefault();
    this.searchInput.focus();
  }

  render() {
    return (
      <Search
        {...this.props}
        minSearch={MIN_SEARCH_LENGTH}
        maxResults={MAX_RESULTS}
        renderInput={({getInputProps}) => (
          <SearchInputWrapper>
            <SearchInputIcon size="14px" />
            <SearchInput
              innerRef={ref => (this.searchInput = ref)}
              {...getInputProps({
                type: 'text',
                placeholder: t('Search'),
              })}
            />
          </SearchInputWrapper>
        )}
      />
    );
  }
}

export default SettingsSearch;

const SearchInputWrapper = styled.div`
  position: relative;
`;

const SearchInputIcon = styled(props => <InlineSvg src="icon-search" {...props} />)`
  color: ${p => p.theme.gray2};
  position: absolute;
  left: 10px;
  top: 8px;
`;

const SearchInput = styled.input`
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
    border: 1px solid ${p => p.theme.gray1};
  }

  &::placeholder {
    color: ${p => p.theme.gray2};
  }
`;
