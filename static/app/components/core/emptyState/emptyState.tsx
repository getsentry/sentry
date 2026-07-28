import {Flex, Stack, type FlexProps} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

interface EmptyStateProps extends Omit<FlexProps, 'title' | 'children'> {
  title: React.ReactNode;
  action?: React.ReactNode;
  description?: React.ReactNode;
  illustration?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  illustration,
  action,
  ...props
}: EmptyStateProps) {
  const textAlign = {xs: 'center' as const, sm: undefined};

  return (
    <Flex
      containerType="inline-size"
      direction={{xs: 'column', sm: 'row'}}
      flexGrow={1}
      align="center"
      gap={{xs: 'xl', sm: '2xl'}}
      justify={{sm: 'center'}}
      data-test-id="empty-state"
      {...props}
    >
      {illustration && (
        <Flex justify="center" align="center" overflow="hidden" flexShrink={0}>
          {illustration}
        </Flex>
      )}
      <Stack gap="xl">
        <Stack gap="md" maxWidth="360px">
          <Heading as="h3" size="lg" align={textAlign}>
            {title}
          </Heading>
          {description && (
            <Text as="p" size="md" variant="muted" align={textAlign} textWrap="balance">
              {description}
            </Text>
          )}
        </Stack>
        <Flex gap="md">{action}</Flex>
      </Stack>
    </Flex>
  );
}
