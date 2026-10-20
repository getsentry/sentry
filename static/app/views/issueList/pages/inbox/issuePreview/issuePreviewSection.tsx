import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

interface Props {
  children: React.ReactNode;
  title: string;
  actions?: React.ReactNode;
}

export function IssuePreviewSection({children, title, actions}: Props) {
  return (
    <Stack as="section" aria-label={title} gap="md">
      <Flex align="center" justify="between" gap="md">
        <Heading as="h3" size="md">
          {title}
        </Heading>
        {actions && (
          <Flex align="center" gap="xs">
            {actions}
          </Flex>
        )}
      </Flex>
      {children}
    </Stack>
  );
}
