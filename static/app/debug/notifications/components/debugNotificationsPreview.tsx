import {Container, Flex} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text';

export function DebugNotificationsPreview({
  title,
  children,
  actions = null,
}: {
  children: React.ReactNode;
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <Container>
      <Flex justify="between" gap="md" padding="md 0">
        <Heading as="h2">{title}</Heading>
        <Flex>{actions}</Flex>
      </Flex>
      <Flex direction="column" gap="sm">
        {children}
      </Flex>
    </Container>
  );
}
