import {ClassNames, css} from '@emotion/core';
import { Component } from 'react';
import styled from '@emotion/styled';
import {ModalBody} from 'react-bootstrap';

import Input from 'app/views/settings/components/forms/controls/input';
import {analytics} from 'app/utils/analytics';
import {t} from 'app/locale';
import Search from 'app/components/search';
import theme from 'app/utils/theme';
import space from 'app/styles/space';

type Props = {
  Body: typeof ModalBody;
};

class CommandPalette extends Component<Props> {
  componentDidMount() {
    analytics('omnisearch.open', {});
  }

  render() {
    const {Body} = this.props;

    return (
      <Body>
        <ClassNames>
          {({css: injectedCss}) => (
            <Search
              isOpen
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
                  <StyledInput
                    autoFocus
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

export default CommandPalette;

export const modalCss = css`
  .modal-content {
    padding: 0;
  }
`;

const InputWrapper = styled('div')`
  padding: ${space(0.25)};
`;

const StyledInput = styled(Input)`
  width: 100%;
  padding: ${space(1)};
  border-radius: 8px;

  outline: none;
  border: none;
  box-shadow: none;

  :focus,
  :active,
  :hover {
    outline: none;
    border: none;
    box-shadow: none;
  }
`;
