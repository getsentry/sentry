import styled from '@emotion/styled';

import space from 'app/styles/space';
import Panel from 'app/components/panels/panel';

const Text = styled('div')`
  ${/* sc-selector */ Panel} & {
    padding-left: ${space(2)};
    padding-right: ${space(2)};

    &:first-child {
      padding-top: ${space(2)};
    }
  }
`;

export default Text;
