import {ClassNames, css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import HelpSearch from 'sentry/components/helpSearch';
import Hook from 'sentry/components/hook';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';

type Props = ModalRenderProps & {
  organization: Organization;
  placeholder?: string;
};

function HelpSearchModal({
  Body,
  closeModal,
  organization,
  placeholder = t('Search for documentation, FAQs, blog posts...'),
  ...props
}: Props) {
  const theme = useTheme();

  return (
    <Body>
      <ClassNames>
        {({css: injectedCss}) => (
          <HelpSearch
            {...props}
            entryPoint="sidebar_help"
            dropdownClassName={injectedCss`
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
            resultFooter={
              <Hook name="help-modal:footer" {...{organization, closeModal}} />
            }
          />
        )}
      </ClassNames>
    </Body>
  );
}

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
  [role='document'] {
    padding: 0;
  }
`;

export default withOrganization(HelpSearchModal);
