import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import useOrganization from 'sentry/utils/useOrganization';

type ActionButtonContainerProps = {children: JSX.Element};

export function IssueActionWrapper({children}: ActionButtonContainerProps) {
  const organization = useOrganization();

  if (!organization.features.includes('issue-priority-ui')) {
    return children;
  }

  return <AnimatedWrapper>{children}</AnimatedWrapper>;
}

const reveal = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const AnimatedWrapper = styled('div')`
  animation: ${reveal} 200ms ease-out;
`;
