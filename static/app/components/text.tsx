import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import {space} from 'sentry/styles/space';
import textStyles from 'sentry/styles/text';

const Text = styled('div')`
  ${textStyles};

  ${Panel} & {
    padding-left: ${space(2)};
    padding-right: ${space(2)};

    &:first-child {
      padding-top: ${space(2)};
    }
  }
`;

export default Text;
