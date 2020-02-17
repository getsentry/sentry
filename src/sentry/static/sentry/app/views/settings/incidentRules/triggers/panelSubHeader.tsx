import styled from '@emotion/styled';

import {PanelHeader} from 'app/components/panels';
import space from 'app/styles/space';

/**
 * Displays a Panel Header that has less vertical padding as to not draw as much attention but still
 * provide some logical separation
 */
const PanelSubHeader = styled(PanelHeader)`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding: ${space(1)} ${space(2)};
`;

export default PanelSubHeader;
