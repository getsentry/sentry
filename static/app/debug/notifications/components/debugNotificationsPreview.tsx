import styled from '@emotion/styled';

import {Heading} from 'sentry/components/core/text/text';

export function DebugNotificationsPreview({
  title,
  children,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div>
      <SectionHeading as="h2">{title}</SectionHeading>
      {children}
    </div>
  );
}

const SectionHeading = styled(Heading)`
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;
