import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import textStyles from 'sentry/styles/text';

type BaseProps = {
  withPadding?: boolean;
};

const PanelBody = styled('div')<BaseProps>`
  ${p => p.withPadding && `padding: ${space(2)}`};
  ${textStyles};
`;

export default PanelBody;
