import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {space} from 'sentry/styles/space';

interface FormSectionProps {
  description: ReactNode;
  title: ReactNode;
  children?: ReactNode;
}

export function FormSection({title, description, children}: FormSectionProps) {
  return (
    <Container>
      <Flex column gap={space(1)}>
        <Title>{title}</Title>
        <Description>{description}</Description>
        <div>{children}</div>
      </Flex>
    </Container>
  );
}

const Container = styled('section')`
  background: ${p => p.theme.surface300};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1.5)} ${space(2)} ${space(1)} ${space(2)};
`;

const Title = styled('h3')`
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.textColor};
  margin: 0;
`;

const Description = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  margin: 0;
`;
