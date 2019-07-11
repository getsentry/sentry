import styled from 'react-emotion';

import {TimeRangeRoot} from 'app/components/organizations/timeRangeSelector/index';
import AutoCompleteRoot from 'app/components/dropdownAutoComplete/autoCompleteRoot';

const HeaderItemPosition = styled('div')`
  display: flex;
  flex: 1;
  max-width: 450px;
  height: 100%;
  min-width: 0;

  /* stylelint-disable-next-line no-duplicate-selectors */
  ${AutoCompleteRoot}, ${TimeRangeRoot} {
    flex: 1;
    min-width: 0;
  }
`;

export default HeaderItemPosition;
