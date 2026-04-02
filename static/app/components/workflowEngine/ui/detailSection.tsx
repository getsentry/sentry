import {Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

type DetailSectionProps = {
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  trailingItems?: React.ReactNode;
};

export function DetailSection({
  children,
  className,
  title,
  trailingItems,
}: DetailSectionProps) {
  return (
    <Flex as="section" role="region" direction="column" gap="md" className={className}>
      <Flex justify="between" align="center">
        <Heading as="h3">{title}</Heading>
        {trailingItems ?? null}
      </Flex>
      {children}
    </Flex>
  );
}
