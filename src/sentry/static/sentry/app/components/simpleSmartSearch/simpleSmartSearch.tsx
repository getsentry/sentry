import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';
import isEqual from 'lodash/isEqual';

import space from 'app/styles/space';
import TextField from 'app/components/forms/textField';
import Tooltip from 'app/components/tooltip';
import {IconSearch} from 'app/icons/iconSearch';
import {IconClose} from 'app/icons/iconClose';
import {t} from 'app/locale';

import SimpleSmartSearchSuggestions from './simpleSmartSearchSuggestions';

type SimpleSmartSearchSource = {
  id: number;
};

type Props<Source extends SimpleSmartSearchSource, Filter extends keyof Source> = {
  source: Array<Source>;
  filterSourceBy: Filter;
  onChange?: (searchTerm: string) => void;
  searchTerm?: string;
  placeholder?: string;
  showMaxResultQuantity?: number;
  hasRecentSearches?: boolean;
  isDisabled?: boolean;
  noLeftCorners?: boolean;
  hasFullWidth?: boolean;
  resultsTitle?: string;
};

type State<Source extends SimpleSmartSearchSource> = {
  isLoading: boolean;
  showSuggestions: boolean;
  searchTerm: string;
  filteredSource: Array<Source>;
};

class SimpleSmartSearch<Source extends SimpleSmartSearchSource> extends React.Component<
  Props<Source, Extract<keyof Source, string>>,
  State<Source>
> {
  state = {
    isLoading: false,
    showSuggestions: false,
    searchTerm: this.props?.searchTerm || '',
    filteredSource: this.props.source,
  };

  handleChange = (searchTerm: string) => {
    const {onChange, source, filterSourceBy} = this.props;

    this.setState(
      {
        searchTerm,
        filteredSource: source.filter(
          s => String(s[filterSourceBy]).indexOf(searchTerm) !== -1
        ),
      },
      () => {
        if (onChange) {
          onChange(searchTerm);
        }
      }
    );
  };

  handleClearSearch = () => {
    this.setState({
      searchTerm: '',
    });
  };

  handleFocus = () => {
    this.setState({
      showSuggestions: true,
    });
  };

  handleBlur = () => {
    this.setState({
      showSuggestions: false,
    });
  };

  render() {
    const {
      placeholder,
      isDisabled,
      noLeftCorners,
      hasFullWidth,
      resultsTitle,
      filterSourceBy,
    } = this.props;

    const {searchTerm, filteredSource} = this.state;

    console.log('filteredSource', filteredSource);

    return (
      <Wrapper hasFullWidth={hasFullWidth}>
        <SearchField>
          <StyledIconSearch color="gray2" />
          <StyledTextField
            name="query"
            placeholder={placeholder}
            autoComplete="off"
            value={searchTerm}
            onChange={this.handleChange}
            onFocus={this.handleFocus}
            onBlur={this.handleBlur}
            disabled={isDisabled}
            noLeftCorners={noLeftCorners}
            height="40px"
          />
          {!!searchTerm.trim() && (
            <WrapperIconClose onClick={this.handleClearSearch}>
              <Tooltip title={t('Clear search')}>
                <StyledIconClose size="xs" />
              </Tooltip>
            </WrapperIconClose>
          )}
        </SearchField>
        {true && (
          <SimpleSmartSearchSuggestions
            resultsTitle={resultsTitle}
            results={filteredSource.map(f => ({
              id: f.id,
              description: String(f[filterSourceBy]),
            }))}
          />
        )}
      </Wrapper>
    );
  }
}

export default SimpleSmartSearch;

const Wrapper = styled('div')<{hasFullWidth?: boolean}>`
  position: relative;
  ${p =>
    p.hasFullWidth &&
    css`
      flex: 1;
    `}
`;

const SearchField = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
`;

const StyledIconSearch = styled(IconSearch)`
  position: absolute;
  left: ${space(1)};
  z-index: 1;
`;

const WrapperIconClose = styled('div')`
  position: absolute;
  right: ${space(2)};
  line-height: 0;
`;

const StyledIconClose = styled(IconClose)`
  cursor: pointer;
  color: ${p => p.theme.gray2};
  &:hover {
    color: ${p => p.theme.gray3};
  }
`;

const StyledTextField = styled(TextField)<{
  noLeftCorners?: boolean;
  hasFullWidth?: boolean;
}>`
  color: ${p => p.theme.foreground};
  background: transparent;
  border: 0;
  outline: none;
  margin-bottom: 0;
  width: 100%;
  font-size: ${p => p.theme.fontSizeMedium};

  &::placeholder {
    color: ${p => p.theme.gray1};
  }

  &:focus {
    border-color: ${p => p.theme.borderDark};
    border-bottom-right-radius: 0;
  }

  .show-sidebar & {
    color: ${p => p.theme.disabled};
  }

  ${p =>
    p.noLeftCorners &&
    css`
      input {
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
        padding-left: ${space(4)};
        padding-right: ${space(4)};
      }
    `}
`;
