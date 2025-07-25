import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';

type SectionProps = {
  title: string;
  children?: React.ReactNode;
  description?: string;
};

export default function Section({children, title, description}: SectionProps) {
  return (
    <SectionContainer direction="column" gap="md">
      <SectionHeading>{title}</SectionHeading>
      {description && <SectionDescription>{description}</SectionDescription>}
      {children}
    </SectionContainer>
  );
}

const SectionContainer = styled(Flex)`
  > p {
    margin-bottom: ${p => p.theme.space['0']};
  }

  p + p {
    margin-top: ${p => p.theme.space.md};
  }
`;

const SectionHeading = styled('h4')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin: 0;
`;

const SectionDescription = styled('p')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.subText};
  margin: 0;
`;
