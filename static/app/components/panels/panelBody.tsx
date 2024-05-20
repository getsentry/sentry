import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

type BaseProps = {
  withPadding?: boolean;
};

const PanelBody = styled('div')<BaseProps>`
  ${p => p.withPadding && `padding: ${space(2)}`};
  ${p => p.theme.textStyles};
`;

export default PanelBody;
