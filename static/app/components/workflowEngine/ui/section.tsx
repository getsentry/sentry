import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

type SectionProps = {
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  trailingItems?: React.ReactNode;
};

export default function Section({
  children,
  className,
  title,
  description,
  trailingItems,
}: SectionProps) {
  return (
    <SectionContainer direction="column" gap="md" className={className}>
      <Flex justify="between" align="center" gap="md">
        <Heading as="h3">{title}</Heading>
        {trailingItems && <Flex gap="md">{trailingItems}</Flex>}
      </Flex>
      {description && <SectionDescription>{description}</SectionDescription>}
      {children}
    </SectionContainer>
  );
}

export const SectionSubHeading = styled('h5')`
  font-size: ${p => p.theme.font.size.md};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin: 0;
`;

const SectionDescription = styled('div')`
  font-size: ${p => p.theme.font.size.md};
  font-weight: ${p => p.theme.font.weight.sans.regular};
  color: ${p => p.theme.tokens.content.secondary};
  margin: 0;
`;

const SectionContainer = styled(Flex)`
  > ${SectionDescription} {
    margin-bottom: ${p => p.theme.space['0']};
  }

  ${SectionDescription} + ${SectionDescription} {
    margin-top: ${p => p.theme.space.md};
  }
`;

// moved above to reference in SectionContainer
