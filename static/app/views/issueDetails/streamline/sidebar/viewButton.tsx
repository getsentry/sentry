import styled from '@emotion/styled';

import {LinkButton, type LinkButtonProps} from 'sentry/components/core/button/linkButton';
import {space} from 'sentry/styles/space';

export function ViewButton({children, ...props}: LinkButtonProps) {
  return (
    <TextButton borderless size="zero" preventScrollReset {...props}>
      {children}
    </TextButton>
  );
}

const TextButton = styled(LinkButton)`
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
  padding: ${space(0.25)} ${space(0.5)};
`;
