import styled from '@emotion/styled';

import {OnboardingSidebarContent} from 'sentry/components/onboardingWizard/content';
import type {useOnboardingTasks} from 'sentry/components/onboardingWizard/useOnboardingTasks';
import SidebarPanel, {
  type SidebarPanelProps,
} from 'sentry/components/sidebar/sidebarPanel';
import type {CommonSidebarProps} from 'sentry/components/sidebar/types';

interface SidebarProps
  extends Pick<SidebarPanelProps, 'title'>,
    Pick<CommonSidebarProps, 'orientation' | 'collapsed'>,
    Pick<
      ReturnType<typeof useOnboardingTasks>,
      'gettingStartedTasks' | 'beyondBasicsTasks'
    > {
  onClose: () => void;
}

/**
 * @deprecated Use `useOnboardingWizardDrawer` instead
 */
export function LegacyOnboardingSidebar({
  onClose,
  orientation,
  collapsed,
  title,
}: SidebarProps) {
  return (
    <Wrapper
      collapsed={collapsed}
      hidePanel={onClose}
      orientation={orientation}
      title={title}
    >
      <OnboardingSidebarContent onClose={onClose} />
    </Wrapper>
  );
}

const Wrapper = styled(SidebarPanel)`
  width: 100%;
  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
    width: 460px;
  }
`;
