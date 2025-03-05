import {ClassNames, css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Input} from 'sentry/components/core/input';
import HelpSearch from 'sentry/components/helpSearch';
import Hook from 'sentry/components/hook';
import {t} from 'sentry/locale';
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
              <InputWithoutFocusStyles
                autoFocus
                {...getInputProps({type: 'text', placeholder})}
              />
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

const InputWithoutFocusStyles = styled(Input)`
  &:focus,
  &:active,
  &:hover {
    outline: none;
    box-shadow: none;
    border: none;
  }
`;

export const modalCss = css`
  [role='document'] {
    padding: 0;
  }
`;

export default withOrganization(HelpSearchModal);
