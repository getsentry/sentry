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
    <Flex
      as="section"
      role="region"
      direction="column"
      gap={description ? 'lg' : 'md'}
      className={className}
    >
      <Flex direction="column" gap="xs">
        <Flex justify="between" align="center">
          <Heading as="h3">{title}</Heading>
          {trailingItems ?? null}
        </Flex>
        {description ? <Text variant="muted">{description}</Text> : null}
      </Flex>
      <Stack gap="md">{children}</Stack>
    </Flex>
  );
}
