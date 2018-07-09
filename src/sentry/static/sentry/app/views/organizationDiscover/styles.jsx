import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

import space from 'app/styles/space';

export const PlaceholderText = styled.div`
  color: #afa3bb;
  font-size: 15px;
`;

export const Fieldset = styled.fieldset`
  margin-bottom: ${space(1)};
`;

export const SelectListItem = styled(Flex)`
  margin-top: ${space(0.5)};
`;
