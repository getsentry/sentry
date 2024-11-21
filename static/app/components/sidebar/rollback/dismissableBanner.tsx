import styled from '@emotion/styled';

import {RollbackBanner} from 'sentry/components/sidebar/rollback/banner';
import {useRollbackPrompts} from 'sentry/components/sidebar/rollback/useRollbackPrompts';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

type DismissableRollbackBannerProps = {collapsed: boolean; organization: Organization};

export function DismissableRollbackBanner({
  collapsed,
  organization,
}: DismissableRollbackBannerProps) {
  const config = useLegacyStore(ConfigStore);

  const isDarkMode = config.theme === 'dark';

  const {shouldShowSidebarBanner, onDismissSidebarBanner} = useRollbackPrompts({
    collapsed,
    organization,
  });

  if (!shouldShowSidebarBanner || !organization) {
    return null;
  }

  return (
    <Wrapper>
      <TranslucentBackgroundBanner
        organization={organization}
        isDarkMode={isDarkMode}
        handleDismiss={onDismissSidebarBanner}
      />
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  padding: 0 ${space(1)};
`;

const TranslucentBackgroundBanner = styled(RollbackBanner)<{isDarkMode: boolean}>`
  position: relative;
  background: rgba(245, 243, 247, ${p => (p.isDarkMode ? 0.05 : 0.1)});
  border: 1px solid rgba(245, 243, 247, ${p => (p.isDarkMode ? 0.1 : 0.15)});
  color: ${p => (p.isDarkMode ? p.theme.textColor : '#ebe6ef')};
  margin: ${space(0.5)} ${space(1)};
`;
