import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import space from 'sentry/styles/space';
import textStyles from 'sentry/styles/text';

type BaseProps = {
  withPadding?: boolean;
};

const PanelBody = styled('div')<BaseProps>`
  ${p => p.withPadding && `padding: ${space(2)}`};
  ${textStyles};
`;

export default PanelBody;

export const CollapsePanelBody = styled(motion.div)`
  ${textStyles};
  overflow: hidden;
`;

CollapsePanelBody.defaultProps = {
  initial: {
    height: 0,
  },
  animate: {
    height: 'auto',
  },
  exit: {
    height: 0,
  },
};
