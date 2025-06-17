import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout/flex';
import {space} from 'sentry/styles/space';

type SectionProps = {
  children: React.ReactNode;
  title: string;
  description?: string;
};

export default function Section({children, title, description}: SectionProps) {
  return (
    <Flex direction="column" gap={space(1)}>
      <SectionHeading>{title}</SectionHeading>
      {description && <SectionDescription>{description}</SectionDescription>}
      {children}
    </Flex>
  );
}

const SectionHeading = styled('h4')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  margin: 0;
`;

const SectionDescription = styled('p')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.subText};
  margin: 0;
`;
