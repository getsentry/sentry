import styled from '@emotion/styled';

import space from 'app/styles/space';
import textStyles from 'app/styles/text';

type BaseProps = {
  withPadding?: boolean;
};

const PanelBody = styled('div')<BaseProps>`
  ${p => p.withPadding && `padding: ${space(2)}`};
  ${textStyles};
`;

export default PanelBody;
