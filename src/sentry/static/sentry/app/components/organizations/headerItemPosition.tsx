import styled from '@emotion/styled';

import {Theme} from 'app/utils/theme';
import {AutoCompleteRoot} from 'app/components/dropdownAutoCompleteMenu';
import {TimeRangeRoot} from 'app/components/organizations/timeRangeSelector/index';

type Props = {
  isSpacer?: boolean;
  theme: Theme;
};

function getMediaQueryForSpacer(p: Props): string {
  return p.isSpacer
    ? `@media (max-width: ${p.theme.breakpoints[1]}) { display: none; }`
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
