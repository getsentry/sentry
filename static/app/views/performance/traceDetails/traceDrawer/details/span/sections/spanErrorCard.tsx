import {Container, Flex, Stack} from '@sentry/scraps/layout';

interface SpanErrorCardProps {
  icon: React.ReactNode;
  message: React.ReactNode;
  title: React.ReactNode;
  className?: string;
}

/**
 * Card for a span that ended in an error without an associated issue. Sits in
 * the same slot as the span's issue list.
 */
export function SpanErrorCard({icon, title, message, className}: SpanErrorCardProps) {
  return (
    <Container className={className} padding="md 0">
      <Flex
        align="center"
        gap="md"
        padding="md xl lg md"
        background="primary"
        border="primary"
        radius="md"
      >
        <Flex align="center" justify="center">
          {icon}
        </Flex>
        <Stack gap="2xs" minWidth="0">
          {title}
          {message}
        </Stack>
      </Flex>
    </Container>
  );
}
