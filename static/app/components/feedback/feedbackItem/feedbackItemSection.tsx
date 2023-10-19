import {ReactNode} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const SectionWrapper = styled('section')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
`;

const SectionTitle = styled('h3')`
  margin: 0;
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
  text-transform: capitalize;

  display: flex;
  gap: ${space(0.5)};
  align-items: center;
`;

export default function Section({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  title: string;
  icon?: ReactNode;
}) {
  return (
    <SectionWrapper>
      <SectionTitle>
        {icon}
        <span>{title}</span>
      </SectionTitle>
      {children}
    </SectionWrapper>
  );
}
