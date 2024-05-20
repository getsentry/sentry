import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import {space} from 'sentry/styles/space';

const Text = styled('div')`
  ${p => p.theme.textStyles};

  ${Panel} & {
    padding-left: ${space(2)};
    padding-right: ${space(2)};

    &:first-child {
      padding-top: ${space(2)};
    }
  }
`;

export default Text;
