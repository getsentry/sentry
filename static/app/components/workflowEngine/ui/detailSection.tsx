import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

type DetailSectionProps = {
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  trailingItems?: React.ReactNode;
};

export function DetailSection({
  children,
  className,
  description,
  title,
  trailingItems,
}: DetailSectionProps) {
  return (
    <Stack
      as="section"
      role="region"
      gap={description ? 'lg' : 'md'}
      className={className}
    >
      <Stack gap="xs">
        <Flex justify="between" align="center">
          <Heading as="h3">{title}</Heading>
          {trailingItems ?? null}
        </Flex>
        {description ? <Text variant="muted">{description}</Text> : null}
      </Stack>
      <Stack gap="md">{children}</Stack>
    </Stack>
  );
}
