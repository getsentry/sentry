import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';

type SectionProps = {
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
};

export default function Section({children, className, title, description}: SectionProps) {
  return (
    <SectionContainer direction="column" gap="md" className={className}>
      <SectionHeading>{title}</SectionHeading>
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

const SectionHeading = styled('h4')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin: 0;
`;

// moved above to reference in SectionContainer
