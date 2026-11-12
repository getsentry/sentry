import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

export const RowFrame = styled(Container)`
  background: ${p => p.theme.tokens.background.primary};
  border-left: 1px solid ${p => p.theme.tokens.border.primary};
  border-right: 1px solid ${p => p.theme.tokens.border.primary};

  &[data-frame-top] {
    border-top: 1px solid ${p => p.theme.tokens.border.primary};
    border-top-left-radius: ${p => p.theme.radius.md};
    border-top-right-radius: ${p => p.theme.radius.md};
  }

  &[data-frame-bottom] {
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
    border-bottom-left-radius: ${p => p.theme.radius.md};
    border-bottom-right-radius: ${p => p.theme.radius.md};
  }

  &[data-separator] {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;
