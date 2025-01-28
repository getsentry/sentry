import styled from '@emotion/styled';

import {LinkButton, type LinkButtonProps} from 'sentry/components/button';
import {space} from 'sentry/styles/space';

export function ViewButton({children, ...props}: LinkButtonProps) {
  return (
    <TextButton borderless size="zero" {...props}>
      {children}
    </TextButton>
  );
}

const TextButton = styled(LinkButton)`
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  padding: ${space(0.25)} ${space(0.5)};
`;
