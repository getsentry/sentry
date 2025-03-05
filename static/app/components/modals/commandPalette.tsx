import {useEffect} from 'react';
import {ClassNames, css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {Search} from 'sentry/components/search';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';

function CommandPalette({Body}: ModalRenderProps) {
  const theme = useTheme();

  useEffect(
    () =>
      void trackAnalytics('omnisearch.open', {
        organization: null,
      }),
    []
  );

  return (
    <Body>
      <ClassNames>
        {({css: injectedCss}) => (
          <Search
            entryPoint="command_palette"
            minSearch={1}
            maxResults={10}
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
              <InputGroup>
                <InputGroup.LeadingItems>
                  <IconSearch size="sm" />
                </InputGroup.LeadingItems>
                <InputWithoutFocusStyles
                  autoFocus
                  {...getInputProps({
                    type: 'text',
                    placeholder: t('Search for projects, teams, settings, etc\u{2026}'),
                  })}
                />
              </InputGroup>
            )}
          />
        )}
      </ClassNames>
    </Body>
  );
}

export default CommandPalette;

const InputWithoutFocusStyles = styled(InputGroup.Input)`
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
