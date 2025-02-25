import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Panel from 'sentry/components/panels/panel';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import useMutateUserOptions from 'sentry/utils/useMutateUserOptions';

import {useNavPrompts} from './useNavPrompts';

type Props = {collapsed: boolean; organization: Organization};

export function OptInBanner({collapsed, organization}: Props) {
  const config = useLegacyStore(ConfigStore);
  const {mutate: mutateUserOptions} = useMutateUserOptions();
  const isDarkMode = config.theme === 'dark';

  const {shouldShowSidebarBanner, onDismissSidebarBanner} = useNavPrompts({
    collapsed,
    organization,
  });

  if (!shouldShowSidebarBanner || !organization) {
    return null;
  }

  return (
    <TranslucentBackgroundPanel isDarkMode={isDarkMode}>
      <Title>{t('✨ Try New Navigation')}</Title>
      <Description>
        {t("We've redesigned our sidebar to make it easier to navigate Sentry.")}
      </Description>
      <OptInButton
        priority="primary"
        size="xs"
        analyticsEventKey="navigation.banner_opt_in_stacked_navigation_clicked"
        analyticsEventName="Navigation: Stacked Navigation Banner Opt In Clicked"
        onClick={() => mutateUserOptions({prefersStackedNavigation: true})}
      >
        {t('Try now')}
      </OptInButton>
      <DismissButton
        icon={<IconClose />}
        aria-label={t('Dismiss')}
        onClick={onDismissSidebarBanner}
        size="xs"
        borderless
        analyticsEventKey="navigation.banner_dismiss_stacked_navigation"
        analyticsEventName="Navigation: Stacked Navigation Banner Dismissed"
      />
    </TranslucentBackgroundPanel>
  );
}

const TranslucentBackgroundPanel = styled(Panel)<{isDarkMode: boolean}>`
  position: relative;
  background: rgba(245, 243, 247, ${p => (p.isDarkMode ? 0.05 : 0.1)});
  border: 1px solid rgba(245, 243, 247, ${p => (p.isDarkMode ? 0.1 : 0.15)});
  padding: ${space(1)};
  color: ${p => (p.isDarkMode ? p.theme.textColor : '#ebe6ef')};

  margin-bottom: ${space(1)};
`;

const Title = styled('p')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightBold};
  margin: 0;
`;

const Description = styled('p')`
  font-size: ${p => p.theme.fontSizeSmall};
  margin: ${space(0.5)} 0;
`;

const OptInButton = styled(Button)`
  margin: 0 auto;
  width: 100%;
`;

const DismissButton = styled(Button)`
  position: absolute;
  top: 0;
  right: 0;

  color: currentColor;

  &:hover {
    color: currentColor;
  }
`;
