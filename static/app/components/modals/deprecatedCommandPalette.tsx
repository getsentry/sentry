import {useEffect} from 'react';
import {ClassNames, css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {Search} from 'sentry/components/search';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';

/**
 * @deprecated to be replaced by `components/commandPalette`.
 */
function DeprecatedCommandPalette({Body, closeModal}: ModalRenderProps) {
  const theme = useTheme();

  useEffect(
    () =>
      trackAnalytics('omnisearch.open', {
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
            onAction={closeModal}
            dropdownClassName={injectedCss`
                width: 100%;
                border: transparent;
                border-top-left-radius: 0;
                border-top-right-radius: 0;
                position: initial;
                box-shadow: none;
                border-top: 1px solid ${theme.tokens.border.primary};
              `}
            renderInput={({getInputProps}) => (
              <InputWithoutFocusStyles
                autoFocus
                {...getInputProps({
                  type: 'text',
                  placeholder: t('Search for projects, teams, settings, etc\u{2026}'),
                })}
              />
            )}
          />
        )}
      </ClassNames>
    </Body>
  );
}

export default DeprecatedCommandPalette;

const InputWithoutFocusStyles = styled(InputGroup.Input)`
  border-radius: ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0 0;

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
