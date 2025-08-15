import {Container} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text';

export function DebugNotificationsPreview({
  title,
  children,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <Container>
      <Heading as="h2">{title}</Heading>
      {children}
    </Container>
  );
}
