import {ThemeProvider} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import Panel from 'sentry/components/panels/panel';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {DO_NOT_USE_lightChonkTheme} from 'sentry/utils/theme/theme.chonk';
import useMutateUserOptions from 'sentry/utils/useMutateUserOptions';

import {useChonkPrompt} from './useChonkPrompt';

export function ChonkOptInBanner(props: {collapsed: boolean}) {
  const chonkPrompt = useChonkPrompt();
  const config = useLegacyStore(ConfigStore);
  const {mutate: mutateUserOptions} = useMutateUserOptions();

  if (props.collapsed || !chonkPrompt.showbannerPrompt) {
    return null;
  }

  return (
    <TranslucentBackgroundPanel isDarkMode={config.theme === 'dark'}>
      <Title>{t('Sentry has a new look')}</Title>
      <Description>
        {t(`We've updated Sentry with a fresh new look, try it out by opting in below.`)}
      </Description>
      <ThemeProvider theme={DO_NOT_USE_lightChonkTheme}>
        <OptInButton
          priority="primary"
          size="xs"
          analyticsEventKey="navigation.banner_opt_in_chonk_ui_clicked"
          analyticsEventName="Navigation: Chonk UI Banner Opt In Clicked"
          onClick={() => mutateUserOptions({prefersChonkUI: true})}
        >
          {t('Try It Out')}
        </OptInButton>
      </ThemeProvider>
      <DismissButton
        icon={<IconClose />}
        aria-label={t('Dismiss')}
        onClick={chonkPrompt.dismissBannerPrompt}
        size="xs"
        borderless
        analyticsEventKey="navigation.banner_dismiss_chonk_ui"
        analyticsEventName="Navigation: Chonk UI Banner Dismissed"
      />
    </TranslucentBackgroundPanel>
  );
}

const TranslucentBackgroundPanel = styled(Panel)<{isDarkMode: boolean}>`
  position: relative;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  padding: ${space(1)};
  color: ${p => p.theme.textColor};

  margin-bottom: ${space(1)};
`;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightBold};
  margin: 0;

  display: flex;
  align-items: center;
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
