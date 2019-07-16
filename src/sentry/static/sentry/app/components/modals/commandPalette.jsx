import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

import {analytics} from 'app/utils/analytics';
import {t} from 'app/locale';
import Search from 'app/components/search';
import theme from 'app/utils/theme';

const dropdownStyle = css`
  width: 100%;
  border: transparent;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  position: initial;
  box-shadow: none;
  border-top: 1px solid ${theme.borderLight};
`;

class CommandPaletteModal extends React.Component {
  static propTypes = {
    closeModal: PropTypes.func,
    onClose: PropTypes.func,
    Body: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
  };

  componentDidMount() {
    analytics('omnisearch.open');
  }

  handleSuccess = data => {
    if (this.props.onClose) {
      this.props.onClose(data);
    }

    this.props.closeModal();
  };

  render() {
    const {Body} = this.props;

    return (
      <Body>
        <Search
          {...this.props}
          entryPoint="command_palette"
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
