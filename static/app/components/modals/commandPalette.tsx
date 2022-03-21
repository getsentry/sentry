import {useEffect} from 'react';
import {ClassNames, css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Input from 'sentry/components/forms/controls/input';
import {Search} from 'sentry/components/search';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {analytics} from 'sentry/utils/analytics';

function CommandPalette({Body}: ModalRenderProps) {
  const theme = useTheme();

  useEffect(() => void analytics('omnisearch.open', {}), []);

  return (
    <Body>
      <ClassNames>
        {({css: injectedCss}) => (
          <Search
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
                border-top: 1px solid ${theme.border};
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
