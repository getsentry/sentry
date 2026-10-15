import styled from '@emotion/styled';

import {Container, type ContainerProps} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

export function Wrap(props: ContainerProps) {
  return <Container marginBottom="3xl" {...props} />;
}

interface TitleProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Title(props: TitleProps) {
  return <StyledHeading as="h6" size="md" variant="muted" {...props} />;
}

// Titles often carry a trailing InfoTip or icon that needs to sit centered next to the text
const StyledHeading = styled(Heading)`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  margin-top: ${p => p.theme.space.md};
`;

export const IconWrapper = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  margin-left: ${p => p.theme.space.xs};
`;

export function Content(props: ContainerProps) {
  return <Container marginTop="md" {...props} />;
}
