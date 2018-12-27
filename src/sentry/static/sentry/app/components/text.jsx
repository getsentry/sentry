import styled from 'react-emotion';

import space from 'app/styles/space';
import textStyles from 'app/styles/text';
import Panel from 'app/components/panels/panel';

const Text = styled.div`
  ${textStyles};

  /* stylelint-disable-next-line no-duplicate-selectors */
  ${Panel} & {
    padding-left: ${space(2)};
    padding-right: ${space(2)};

    &:first-child {
      padding-top: ${space(2)};
    }
  }
`;

export default Text;
