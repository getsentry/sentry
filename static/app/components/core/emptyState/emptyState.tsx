import {Flex, Stack, type FlexProps} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

interface EmptyStateProps extends Omit<FlexProps, 'title'> {
  title: React.ReactNode;
  action?: React.ReactNode;
  description?: React.ReactNode;
  illustration?: React.ReactNode;
  orientation?: 'vertical' | 'horizontal';
}

export function EmptyState({
  title,
  description,
  illustration,
  action,
  orientation = 'vertical',
  ...props
}: EmptyStateProps) {
  const isVertical = orientation === 'vertical';
  const textAlign = isVertical ? ('center' as const) : undefined;

  const copy = (
    <Stack gap="md" maxWidth="360px">
      <Text bold size="lg" align={textAlign}>
        {title}
      </Text>
      {description && (
        <Text size="md" variant="muted" align={textAlign} textWrap="balance">
          {description}
        </Text>
      )}
    </Stack>
  );

  if (!isVertical) {
    return (
      <Flex
        align="center"
        gap="2xl"
        justify="center"
        data-test-id="empty-state"
        {...props}
      >
        {illustration && (
          <Flex justify="center" align="center" overflow="hidden" flexShrink={0}>
            {illustration}
          </Flex>
        )}
        <Stack gap="xl">
          {copy}
          {action}
        </Stack>
      </Flex>
    );
  }

  return (
    <Stack align="center" gap="xl" data-test-id="empty-state" {...props}>
      {illustration && (
        <Flex justify="center" overflow="hidden">
          {illustration}
        </Flex>
      )}
      {copy}
      {action}
    </Stack>
  );
}
