import styled from '@emotion/styled';

import {usePrompt} from 'sentry/actionCreators/prompts';
import {useRollback} from 'sentry/components/sidebar/rollback/useRollback';
import useOrganization from 'sentry/utils/useOrganization';

type RollbackNotificationDotProps = {
  collapsed: boolean;
};

export function RollbackNotificationDot({collapsed}: RollbackNotificationDotProps) {
  const organization = useOrganization();
  const {data} = useRollback();

  const {isPromptDismissed: isSidebarPromptDismissed} = usePrompt({
    feature: 'rollback_2024_sidebar',
    organization,
  });

  const {isPromptDismissed: isDropdownPromptDismissed} = usePrompt({
    feature: 'rollback_2024_dropdown',
    organization,
  });

  if (!data || isDropdownPromptDismissed || (!collapsed && !isSidebarPromptDismissed)) {
    return null;
  }

  return <Dot />;
}

const Dot = styled('div')`
  width: 11px;
  height: 11px;
  border-radius: 50%;
  position: absolute;
  background-color: #ff45a8;
  left: 25px;
  top: -2px;
`;
