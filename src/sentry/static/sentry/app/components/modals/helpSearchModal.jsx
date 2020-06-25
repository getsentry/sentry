import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import {ClassNames, css} from '@emotion/core';

import {t} from 'app/locale';
import Search from 'app/components/search';
import HelpSource from 'app/components/search/sources/helpSource';
import theme from 'app/utils/theme';

class HelpSearchModal extends React.Component {
  static propTypes = {
    Body: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
  };

  render() {
    const {Body} = this.props;

    return (
      <Body>
        <ClassNames>
          {({css: injectedCss}) => (
            <Search
              {...this.props}
              sources={[HelpSource]}
              entryPoint="sidebar_help"
              minSearch={3}
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
              closeOnSelect={false}
              renderInput={({getInputProps}) => (
                <InputWrapper>
                  <Input
                    autoFocus
                    {...getInputProps({
                      type: 'text',
                      placeholder: t('Search for Docs and FAQs...'),
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

export const modalCss = css`
  .modal-content {
    padding: 0;
  }
`;

export default HelpSearchModal;
