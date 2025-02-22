import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {space} from 'sentry/styles/space';

type SectionProps = {
  children: React.ReactNode;
  title: string;
};

export default function Section({children, title}: SectionProps) {
  return (
    <Flex column gap={space(1)}>
      <SectionHeading>{title}</SectionHeading>
      {children}
    </Flex>
  );
}

export const SectionHeading = styled('h4')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
`;
