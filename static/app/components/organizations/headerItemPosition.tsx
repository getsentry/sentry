import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {AutoCompleteRoot} from 'sentry/components/dropdownAutoComplete/menu';
import {TimeRangeRoot} from 'sentry/components/organizations/timeRangeSelector/index';
import {Theme} from 'sentry/utils/theme';

type Props = {
  isSpacer?: boolean;
};

function getMediaQueryForSpacer(p: Props & {theme: Theme}) {
  return p.isSpacer
    ? css`
        @media (max-width: ${p.theme.breakpoints.medium}) {
          display: none;
        }
      `
    : '';
}

const HeaderItemPosition = styled('div')<Props>`
  display: flex;
  flex: 1;
  min-width: 0;
  height: 100%;

  ${getMediaQueryForSpacer}

  ${AutoCompleteRoot}, ${TimeRangeRoot} {
    flex: 1;
    min-width: 0;
  }
`;

export default HeaderItemPosition;
