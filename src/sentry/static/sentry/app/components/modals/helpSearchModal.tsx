import React from 'react';
import {ClassNames, css} from '@emotion/core';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'app/actionCreators/modal';
import HelpSearch from 'app/components/helpSearch';
import Hook from 'app/components/hook';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import theme from 'app/utils/theme';

type Props = ModalRenderProps & {
  organization: Organization;
  placeholder?: string;
};

const HelpSearchModal = ({
  Body,
  closeModal,
  organization,
  placeholder = t('Search for documentation, FAQs, blog posts...'),
  ...props
}: Props) => (
  <Body>
    <ClassNames>
      {({css: injectedCss}) => (
        <HelpSearch
          {...props}
          entryPoint="sidebar_help"
          dropdownStyle={injectedCss`
                width: 100%;
                border: transparent;
                border-top-left-radius: 0;
                border-top-right-radius: 0;
                position: initial;
                box-shadow: none;
                border-top: 1px solid ${theme.border};
              `}
          renderInput={({getInputProps}) => (
            <InputWrapper>
              <Input autoFocus {...getInputProps({type: 'text', placeholder})} />
            </InputWrapper>
          )}
          resultFooter={<Hook name="help-modal:footer" {...{organization, closeModal}} />}
        />
      )}
    </ClassNames>
  </Body>
);

const InputWrapper = styled('div')`
  padding: ${space(0.25)};
`;

const Input = styled('input')`
  width: 100%;
  padding: ${space(1)};
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
