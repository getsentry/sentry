import {useEffect} from 'react';
import {ClassNames, css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {Search} from 'sentry/components/search';
import ApiSource from 'sentry/components/search/sources/apiSource';
import CommandSource from 'sentry/components/search/sources/commandSource';
import FormSource from 'sentry/components/search/sources/formSource';
import OrganizationsSource from 'sentry/components/search/sources/organizationsSource';
import RouteSource from 'sentry/components/search/sources/routeSource';
import ShortcutsSource from 'sentry/components/search/sources/shortcutsSource';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';

function CommandPalette({Body}: ModalRenderProps) {
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
            sources={[
              ShortcutsSource,
              ApiSource,
              FormSource,
              RouteSource,
              OrganizationsSource,
              CommandSource,
            ]}
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
                {...getInputProps({
                  type: 'text',
                  placeholder: t(
                    'Search for keyboard shortcuts, projects, teams, settings, etc\u{2026}'
                  ),
                })}
              />
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
