import styled from '@emotion/styled';

import {textStyles} from 'sentry/styles/text';

type BaseProps = {
  display?: 'contents';
  withPadding?: boolean;
};

export const PanelBody = styled('div')<BaseProps>`
  ${p => p.display && `display: ${p.display};`}
  padding: ${p => (p.withPadding ? p.theme.space.xl : undefined)};
  ${textStyles};
`;
