import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import TextField from 'app/views/settings/components/forms/textField';

type Props = {
  onChange?: (searchTerm: string) => void;
  searchTerm?: string;
  placeholder?: string;
  showMaxResultQuantity?: number;
  hasRecentSearches?: boolean;
  isDisabled?: boolean;
};

type State = {
  isLoading: boolean;
  searchTerm: string;
  searchResult: Array<string>;
};

class SimpleSmartSearch extends React.Component<Props, State> {
  state = {
    isLoading: false,
    searchTerm: this.props.searchTerm || '',
    searchResult: [],
  };

  handleChange = (searchTerm: string) => {
    const {onChange} = this.props;

    this.setState(
      {
        searchTerm,
      },
      () => {
        if (onChange) {
          onChange(searchTerm);
        }
      }
    );
  };

  render() {
    const {placeholder, isDisabled} = this.props;
    const {searchTerm, isLoading, searchResult} = this.state;

    return (
      <React.Fragment>
        <StyledTextField
          name="query"
          placeholder={placeholder}
          autoComplete="off"
          value={searchTerm}
          onChange={this.handleChange}
          disabled={isDisabled}
        />
      </React.Fragment>
    );
  }
}

export default SimpleSmartSearch;

const StyledTextField = styled(TextField)`
  color: ${p => p.theme.foreground};
  background: transparent;
  border: 0;
  outline: none;

  font-size: ${p => p.theme.fontSizeMedium};
  width: 100%;
  padding: 0 0 0 ${space(1)};

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
`;
