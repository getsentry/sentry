import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import textStyles from 'sentry/styles/text';

const Text = styled('div')`
  ${textStyles};

  ${Panel} & {
    padding-left: ${p => p.theme.space(2)};
    padding-right: ${p => p.theme.space(2)};

    &:first-child {
      padding-top: ${p => p.theme.space(2)};
    }
  }
`;

export default Text;
