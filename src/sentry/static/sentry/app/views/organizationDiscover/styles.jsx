import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

import space from 'app/styles/space';

export const PlaceholderText = styled.div`
  color: ${p => p.theme.gray6};
  font-size: 15px;
`;

export const Fieldset = styled.fieldset`
  margin-bottom: ${space(1)};
`;

export const SelectListItem = styled(Flex)`
  margin-top: ${space(0.5)};
`;

export const AddText = styled.span`
  font-style: italic;
  text-decoration: underline;
  margin-left: 4px;
  font-size: 13px;
  line-height: 16px;
  color: ${p => p.theme.gray1};
`;
