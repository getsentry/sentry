import styled from '@emotion/styled';

import textStyles from 'sentry/styles/text';

type BaseProps = {
  withPadding?: boolean;
};

const PanelBody = styled('div')<BaseProps>`
  ${p => p.withPadding && `padding: ${p.theme.space(2)}`};
  ${textStyles};
`;

export default PanelBody;
