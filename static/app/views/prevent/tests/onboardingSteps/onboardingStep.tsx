import {useState} from 'react';
import styled from '@emotion/styled';

import {Container, Flex} from 'sentry/components/core/layout';
import {IconChevron} from 'sentry/icons';

const StepContainer = styled('div')`
  display: flex;
  flex-direction: column;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

// this wraps Header and Content
const Body = styled(Flex)`
  flex-direction: column;
  padding: ${p => p.theme.space.xl} ${p => p.theme.space['3xl']};
`;

const Header = styled('h3')`
  font-size: ${p => p.theme.fontSize.xl};
  color: ${p => p.theme.gray300};
  margin-bottom: 0;
  line-height: 31px;
`;

const Content = styled(Container)`
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
      <ExpandableContentTrigger onClick={() => setIsExpanded(!isExpanded)}>
        {triggerContent}
        <IconChevron direction={isExpanded ? 'up' : 'down'} />
      </ExpandableContentTrigger>
      {isExpanded && <ExpandedContent>{children}</ExpandedContent>}
    </ExpandableContentContainer>
  );
}

const ExpandableContentContainer = styled(Container)`
  border-top: 1px solid ${p => p.theme.border};
  margin-top: auto;
  padding: ${p => p.theme.space.xl} ${p => p.theme.space['3xl']};
`;

const ExpandableContentTrigger = styled(Flex)`
  justify-content: space-between;
  align-items: center;
  :hover {
    cursor: pointer;
  }
`;

const ExpandedContent = styled(Container)`
  padding-top: ${p => p.theme.space['2xl']};
`;

export const OnboardingStep = {
  Container: StepContainer,
  Header,
  Content,
  Body,
  ExpandableDropdown,
};
