import styled from '@emotion/styled';

import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

type FormSectionProps = {
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  defaultExpanded?: boolean;
  description?: React.ReactNode;
  step?: number;
  trailingItems?: React.ReactNode;
};

export function FormSection({
  children,
  className,
  title,
  description,
  step,
  trailingItems,
  defaultExpanded = true,
}: FormSectionProps) {
  return (
    <Disclosure
      as="section"
      size="md"
      role="region"
      defaultExpanded={defaultExpanded}
      className={className}
    >
      <Disclosure.Title trailingItems={trailingItems}>
        <Heading as="h3">
          {step ? `${step}. ` : ''}
          {title}
        </Heading>
      </Disclosure.Title>
      <Disclosure.Content>
        <Flex direction="column" gap="md">
          {description && (
            <FormSectionDescription as="p" variant="secondary">
              {description}
            </FormSectionDescription>
          )}
          {children}
        </Flex>
      </Disclosure.Content>
    </Disclosure>
  );
}

export function FormSectionSubHeading({children}: {children: React.ReactNode}) {
  return <Heading as="h5">{children}</Heading>;
}

// The Disclosure adds padding to the title so we need a negative margin to visually align the description with the title
const FormSectionDescription = styled(Text)`
  margin: -${p => p.theme.space.md} 0 0 0;
`;
