import styled from 'react-emotion';
import {AutoCompleteRoot} from 'app/components/dropdownAutoCompleteMenu';

const HeaderItemPosition = styled.div`
  display: flex;
  flex: 1;
  max-width: 450px;
  height: 100%;

  /* stylelint-disable-next-line no-duplicate-selectors */
  ${AutoCompleteRoot} {
    flex: 1;
  }
`;

export default HeaderItemPosition;
