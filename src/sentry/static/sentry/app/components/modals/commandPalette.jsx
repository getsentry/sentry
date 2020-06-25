import {ClassNames, css} from '@emotion/core';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {analytics} from 'app/utils/analytics';
import {t} from 'app/locale';
import Search from 'app/components/search';
import theme from 'app/utils/theme';

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
        <ClassNames>
          {({css: injectedCss}) => (
            <Search
              {...this.props}
              entryPoint="command_palette"
              minSearch={1}
              maxResults={10}
              dropdownStyle={injectedCss`
                width: 100%;
                border: transparent;
                border-top-left-radius: 0;
                border-top-right-radius: 0;
                position: initial;
                box-shadow: none;
                border-top: 1px solid ${theme.borderLight};
              `}
              renderInput={({getInputProps}) => (
                <InputWrapper>
                  <Input
                    autoFocus
                    ref={ref => (this.searchInput = ref)}
                    {...getInputProps({
                      type: 'text',
                      placeholder: t('Search for projects, teams, settings, etc...'),
                    })}
                  />
                </InputWrapper>
              )}
            />
          )}
        </ClassNames>
      </Body>
    );
  }
}

export default CommandPaletteModal;

export const modalCss = css`
  .modal-content {
    padding: 0;
  }
`;

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
