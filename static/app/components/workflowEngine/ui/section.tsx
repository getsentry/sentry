import styled from '@emotion/styled';

import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

type SectionProps = {
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  defaultExpanded?: boolean;
  description?: React.ReactNode;
  step?: number;
  trailingItems?: React.ReactNode;
};

export function Section({
  children,
  className,
  title,
  description,
  step,
  trailingItems,
  defaultExpanded = true,
}: SectionProps) {
  return (
    <Disclosure
      as="section"
      size="md"
      role="region"
      defaultExpanded={defaultExpanded}
      className={className}
    >
      <Disclosure.Title trailingItems={trailingItems}>
        <Text size="lg">
          {step ? `${step}. ` : ''}
          {title}
        </Text>
      </Disclosure.Title>
      <Disclosure.Content>
        <Flex direction="column" gap="md">
          {description && <SectionDescription>{description}</SectionDescription>}
          {children}
        </Flex>
      </Disclosure.Content>
    </Disclosure>
  );
}

export const SectionSubHeading = styled('h5')`
  font-size: ${p => p.theme.font.size.md};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin: 0;
`;

const SectionDescription = styled('p')`
  font-size: ${p => p.theme.font.size.md};
  font-weight: ${p => p.theme.font.weight.sans.regular};
  color: ${p => p.theme.tokens.content.secondary};
  margin: -${p => p.theme.space.md} 0 0 0;
`;
