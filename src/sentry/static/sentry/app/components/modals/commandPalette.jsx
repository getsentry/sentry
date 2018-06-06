import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

import {t} from 'app/locale';
import Search from 'app/components/search';
import SearchResult from 'app/components/search/searchResult';
import SearchResultWrapper from 'app/components/search/searchResultWrapper';

const dropdownStyle = css`
  width: 100%;
  border: transparent;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  position: initial;
  box-shadow: none;
`;

class CommandPaletteModal extends React.Component {
  static propTypes = {
    closeModal: PropTypes.func,
    onClose: PropTypes.func,
    Body: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
  };

  handleSuccess = data => {
    if (this.props.onClose) {
      this.props.onClose(data);
    }

    this.props.closeModal();
  };

  render() {
    let {Body} = this.props;

    return (
      <Body>
        <Search
          {...this.props}
          minSearch={1}
          maxResults={10}
          dropdownStyle={dropdownStyle}
          renderInput={({getInputProps}) => (
            <InputWrapper>
              <Input
                autoFocus
                innerRef={ref => (this.searchInput = ref)}
                {...getInputProps({
                  type: 'text',
                  placeholder: t('Search for projects, teams, settings, etc...'),
                })}
              />
            </InputWrapper>
          )}
          renderItem={({item, matches, itemProps, highlighted}) => (
            <CommandPaletteSearchResultWrapper {...itemProps} highlighted={highlighted}>
              <SearchResult highlighted={highlighted} item={item} matches={matches} />
            </CommandPaletteSearchResultWrapper>
          )}
        />
      </Body>
    );
  }
}

export default CommandPaletteModal;

const InputWrapper = styled('div')`
  padding: 2px;
`;

const Input = styled('input')`
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 8px;
  outline: none;

  &:focus {
    outline: none;
  }
`;

const CommandPaletteSearchResultWrapper = styled(SearchResultWrapper)`
  &:first-child {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }

  ${p =>
    p.highlighted &&
    css`
      color: ${p.theme.whiteDark};
      background: ${p.theme.purpleLight};
    `};
`;
