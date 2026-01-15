import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {TabList, TabPanels, Tabs} from 'sentry/components/core/tabs';
import HookOrDefault from 'sentry/components/hookOrDefault';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {PreviewSection} from 'sentry/views/detectors/components/forms/cron/previewSection';
import MonitorCreateForm from 'sentry/views/insights/crons/components/monitorCreateForm';

import {PlatformPickerPanel} from './platformPickerPanel';
import {useCronsUpsertGuideState} from './useCronsUpsertGuideState';

export function CronsLandingPanel() {
  const organization = useOrganization();

  const {platformKey, guideKey, platform, setPlatformGuide} = useCronsUpsertGuideState();
  const guideVisibile = platform && guideKey;

  const OnboardingPanelHook = HookOrDefault({
    hookName: 'component:crons-onboarding-panel',
    defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
  });

  useEffect(() => {
    if (!guideVisibile) {
      return;
    }

    trackAnalytics('landing_page.platform_guide.viewed', {
      organization,
      platform: platformKey ?? '',
      guide: guideKey,
    });
  }, [organization, platformKey, guideKey, guideVisibile]);

  if (!guideVisibile) {
    return (
      <OnboardingPanelHook>
        <PlatformPickerPanel onSelect={setPlatformGuide} />
      </OnboardingPanelHook>
    );
  }

  return (
    <OnboardingPanelHook>
      <Panel>
        <BackButton
          icon={<IconChevron direction="left" />}
          onClick={() => setPlatformGuide(null)}
          borderless
        >
          {t('Back to Platforms')}
        </BackButton>
        <PanelBody withPadding>
          <h3>{t('Get Started with %s', platform.label)}</h3>
          <Tabs onChange={key => setPlatformGuide(platformKey, key)} value={guideKey}>
            <TabList>
              {[
                ...platform.guides.map(({key, title}) => (
                  <TabList.Item key={key}>{title}</TabList.Item>
                )),
                <TabList.Item key="manual">{t('Manual')}</TabList.Item>,
              ]}
            </TabList>
            <TabPanels>
              {[
                ...platform.guides.map(({key, Guide}) => (
                  <TabPanels.Item key={key}>
                    <GuideContainer>
                      <Guide />
                    </GuideContainer>
                  </TabPanels.Item>
                )),
                <TabPanels.Item key="manual">
                  <GuideContainer>
                    <MonitorCreateForm />
                  </GuideContainer>
                </TabPanels.Item>,
              ]}
            </TabPanels>
          </Tabs>
        </PanelBody>
      </Panel>
    </OnboardingPanelHook>
  );
}

const BackButton = styled(Button)`
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.tokens.content.secondary};
  margin: ${space(1)} 0 0 ${space(1)};
  padding-left: ${space(0.5)};
  padding-right: ${space(0.5)};
`;

const GuideContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  padding-top: ${space(2)};
`;
