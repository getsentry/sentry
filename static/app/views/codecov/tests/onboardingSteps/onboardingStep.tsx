import {useState} from 'react';
import styled from '@emotion/styled';

import {IconChevron} from 'sentry/icons';

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

// this wraps Header and Content
const Body = styled('div')`
  display: flex;
  flex-direction: column;
  padding: ${p => p.theme.space.xl} ${p => p.theme.space['3xl']};
`;

const Header = styled('h3')`
  font-size: ${p => p.theme.fontSize.xl};
  color: ${p => p.theme.gray300};
  margin-bottom: 0;
  line-height: 31px;
`;

const Content = styled('div')`
  margin-top: ${p => p.theme.space.xs};
`;

function ExpandableDropdown({
  triggerContent,
  children,
}: {
  children: React.ReactNode;
  triggerContent: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <ExpandableContentContainer>
      <ExpandableContentTrigger>
        {triggerContent}
        <IconChevron
          direction={isExpanded ? 'up' : 'down'}
          onClick={() => setIsExpanded(!isExpanded)}
        />
      </ExpandableContentTrigger>
      {isExpanded && <ExpandedContent>{children}</ExpandedContent>}
    </ExpandableContentContainer>
  );
}

const ExpandableContentContainer = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  margin-top: auto;
  padding: ${p => p.theme.space.xl} ${p => p.theme.space['3xl']};
`;

const ExpandableContentTrigger = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ExpandedContent = styled('div')`
  padding-top: ${p => p.theme.space['2xl']};
`;

export const OnboardingStep = {
  Container,
  Header,
  Content,
  Body,
  ExpandableDropdown,
};
