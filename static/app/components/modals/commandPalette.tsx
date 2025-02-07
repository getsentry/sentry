import {useEffect} from 'react';
import {ClassNames, css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import Input from 'sentry/components/input';
import {Search} from 'sentry/components/search';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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
              <InputWrapper>
                <StyledInput
                  autoFocus
                  {...getInputProps({
                    type: 'text',
                    placeholder: t('Search for projects, teams, settings, etc\u{2026}'),
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

export default CommandPalette;

export const modalCss = css`
  [role='document'] {
    padding: 0;
  }
`;

const InputWrapper = styled('div')`
  padding: ${space(0.25)};
`;

const StyledInput = styled(Input)`
  width: 100%;
  padding: ${space(1)};
  border-radius: ${p => p.theme.borderRadius};

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
