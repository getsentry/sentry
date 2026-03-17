import styled from '@emotion/styled';

import {textStyles} from 'sentry/styles/text';

type BaseProps = {
  withPadding?: boolean;
};

export const PanelBody = styled('div')<BaseProps>`
  padding: ${p => (p.withPadding ? p.theme.space.xl : undefined)};
  ${textStyles};
`;
