import styled from 'react-emotion';
import {AutoCompleteRoot} from 'app/components/dropdownAutoCompleteMenu';
import {TimeRangeRoot} from 'app/components/organizations/timeRangeSelector/index';

const HeaderItemPosition = styled('div')<{
  isSpacer?: boolean;
}>`
  display: flex;
  flex: 1;
  min-width: 0;
  height: 100%;

  ${p =>
    p.isSpacer &&
    `
    @media(max-width: 1024px) {
      display: none;
    }
  `}

  ${AutoCompleteRoot}, ${TimeRangeRoot} {
    flex: 1;
    min-width: 0;
  }
`;

export default HeaderItemPosition;
