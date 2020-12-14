import styled from '@emotion/styled';

import Panel from 'app/components/panels/panel';
import space from 'app/styles/space';

const Text = styled('div')`
  *:last-child {
    margin-bottom: 0;
  }

  ${/* sc-selector */ Panel} & {
    padding-left: ${space(2)};
    padding-right: ${space(2)};

    &:first-child {
      padding-top: ${space(2)};
    }
  }
`;

export default Text;
