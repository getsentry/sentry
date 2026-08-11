import {Flex, Stack, type FlexProps} from '@sentry/scraps/layout';
import {Heading, Text, type TextProps} from '@sentry/scraps/text';

interface EmptyStateProps extends Omit<
  FlexProps,
  'title' | 'children' | 'containerType'
> {
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
  const switchOn = 'xs';
  const textAlign: TextProps<'p'>['align'] = {zero: 'center', [switchOn]: 'left'};

  return (
    <Flex containerType="inline-size" width="100%" flexGrow={1} minWidth={0}>
      <Flex
        direction={{zero: 'column', [switchOn]: 'row'}}
        flexGrow={1}
        align="center"
        gap={{zero: 'xl', [switchOn]: '2xl'}}
        justify={{zero: 'start', [switchOn]: 'center'}}
        data-test-id="empty-state"
        {...props}
      >
        {illustration && (
          <Flex justify="center" align="center" overflow="hidden" flexShrink={0}>
            {illustration}
          </Flex>
        )}
        <Stack gap="xl">
          <Stack gap="md" width="100%" maxWidth="48ch">
            <Heading as="h3" size="lg" align={textAlign}>
              {title}
            </Heading>
            {description && (
              <Text as="p" size="md" variant="muted" align={textAlign} textWrap="balance">
                {description}
              </Text>
            )}
          </Stack>
          {action && (
            <Flex gap="md" justify={{zero: 'center', [switchOn]: 'start'}} wrap="wrap">
              {action}
            </Flex>
          )}
        </Stack>
      </Flex>
    </Flex>
  );
}
