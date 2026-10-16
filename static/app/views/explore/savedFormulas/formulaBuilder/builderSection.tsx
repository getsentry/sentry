import {InfoTip} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

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
    <Stack gap="xs">
      <Flex align="center" gap="xs">
        <Heading as="h6" size="md">
          {title}
        </Heading>
        {description ? <InfoTip size="xs" title={description} /> : null}
      </Flex>
      {children}
    </Stack>
  );
}
