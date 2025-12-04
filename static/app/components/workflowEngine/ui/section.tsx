import styled from '@emotion/styled';

import {Heading} from '@sentry/scraps/text';

import {Flex} from 'sentry/components/core/layout';

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
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin: 0;
`;

const SectionDescription = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.subText};
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
