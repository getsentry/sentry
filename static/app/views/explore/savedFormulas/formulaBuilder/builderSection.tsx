import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

export const FIELD_MAX_WIDTH = '900px';

export function BuilderSection({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Heading as="h5">{title}</Heading>
        {description ? <Text variant="secondary">{description}</Text> : null}
      </Stack>
      {children}
    </Stack>
  );
}
