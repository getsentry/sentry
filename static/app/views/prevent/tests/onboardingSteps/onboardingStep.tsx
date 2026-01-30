import {useState} from 'react';

import {Container, Flex} from '@sentry/scraps/layout';
import type {FlexProps} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {IconChevron} from 'sentry/icons';

function StepContainer({children}: {children: React.ReactNode}) {
  return (
    <Container border="primary" radius="md">
      <Flex direction="column">{children}</Flex>
    </Container>
  );
}

function Body(props: {children: React.ReactNode}) {
  return <Flex direction="column" padding="2xl 3xl" gap="xl" {...props} />;
}

function Header(props: {children: React.ReactNode}) {
  return <Heading as="h3" size="xl" variant="muted" {...props} />;
}

function Content(props: React.PropsWithChildren<FlexProps>) {
  return <Flex direction="column" gap="xl" {...props} />;
}

function ExpandableDropdown({
  triggerContent,
  children,
}: {
  children: React.ReactNode;
  triggerContent: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Container borderTop="primary">
      <Flex
        justify="between"
        align="center"
        padding="xl 3xl"
        role="button"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {triggerContent}
        <IconChevron direction={isExpanded ? 'up' : 'down'} />
      </Flex>
      {isExpanded && <Container padding="sm 3xl 3xl 3xl">{children}</Container>}
    </Container>
  );
}

export const OnboardingStep = {
  Container: StepContainer,
  Header,
  Content,
  Body,
  ExpandableDropdown,
};
