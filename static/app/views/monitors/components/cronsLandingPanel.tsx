import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import HookOrDefault from 'sentry/components/hookOrDefault';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {TabList, TabPanels, Tabs} from 'sentry/components/tabs';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import MonitorCreateForm from 'sentry/views/monitors/components/monitorCreateForm';

import type {SupportedPlatform} from './platformPickerPanel';
import {CRON_SDK_PLATFORMS, PlatformPickerPanel} from './platformPickerPanel';
import type {QuickStartProps} from './quickStartEntries';
import {
  CeleryBeatAutoDiscovery,
  GoUpsertPlatformGuide,
  JavaUpsertPlatformGuide,
  LaravelUpsertPlatformGuide,
  NodeJsUpsertPlatformGuide,
  PHPUpsertPlatformGuide,
  RubyRailsMixinPlatformGuide,
  RubySidekiqAutoPlatformGuide,
  RubyUpsertPlatformGuide,
} from './quickStartEntries';

enum GuideKey {
  BEAT_AUTO = 'beat_auto',
  UPSERT = 'upsert',
  MANUAL = 'manual',
  MIXIN = 'mixin',
  SIDEKIQ_AUTO = 'sidekiq_auto',
}

interface PlatformGuide {
  Guide: React.ComponentType<QuickStartProps>;
  key: GuideKey;
  title: string;
}

const platformGuides: Record<SupportedPlatform, PlatformGuide[]> = {
  'python-celery': [
    {
      Guide: CeleryBeatAutoDiscovery,
      title: 'Beat Auto Discovery',
      key: GuideKey.BEAT_AUTO,
    },
  ],
  php: [
    {
      Guide: PHPUpsertPlatformGuide,
      title: 'Upsert',
      key: GuideKey.UPSERT,
    },
  ],
  'php-laravel': [
    {
      Guide: LaravelUpsertPlatformGuide,
      title: 'Upsert',
      key: GuideKey.UPSERT,
    },
  ],
  python: [],
  node: [
    {
      Guide: NodeJsUpsertPlatformGuide,
      title: 'Upsert',
      key: GuideKey.UPSERT,
    },
  ],
  go: [
    {
      Guide: GoUpsertPlatformGuide,
      title: 'Upsert',
      key: GuideKey.UPSERT,
    },
  ],
  java: [
    {
      Guide: JavaUpsertPlatformGuide,
      title: 'Upsert',
      key: GuideKey.UPSERT,
    },
  ],
  'java-spring-boot': [],
  ruby: [
    {
      Guide: RubyUpsertPlatformGuide,
      title: 'Upsert',
      key: GuideKey.UPSERT,
    },
  ],
  'ruby-rails': [
    {
      Guide: RubySidekiqAutoPlatformGuide,
      title: 'Sidekiq Auto Discovery',
      key: GuideKey.SIDEKIQ_AUTO,
    },
    {
      Guide: RubyRailsMixinPlatformGuide,
      title: 'Mixin',
      key: GuideKey.MIXIN,
    },
  ],
};

export function isValidPlatform(platform?: string | null): platform is SupportedPlatform {
  return !!(platform && platform in platformGuides);
}

export function isValidGuide(guide?: string): guide is GuideKey {
  return !!(guide && Object.values<string>(GuideKey).includes(guide));
}

export function CronsLandingPanel() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const platform = decodeScalar(location.query?.platform) ?? null;
  const guide = decodeScalar(location.query?.guide);

  const OnboardingPanelHook = HookOrDefault({
    hookName: 'component:crons-onboarding-panel',
    defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
  });

  useEffect(() => {
    if (!platform || !guide) {
      return;
    }

    trackAnalytics('landing_page.platform_guide.viewed', {
      organization,
      platform,
      guide,
    });
  }, [organization, platform, guide]);

  const navigateToPlatformGuide = (
    selectedPlatform: SupportedPlatform | null,
    selectedGuide?: string
  ) => {
    if (!selectedPlatform) {
      navigate({
        pathname: location.pathname,
        query: {...location.query, platform: undefined, guide: undefined},
      });
      return;
    }

    if (!selectedGuide) {
      selectedGuide = platformGuides[selectedPlatform][0]?.key ?? GuideKey.MANUAL;
    }
    navigate({
      pathname: location.pathname,
      query: {...location.query, platform: selectedPlatform, guide: selectedGuide},
    });
  };

  if (!isValidPlatform(platform) || !isValidGuide(guide)) {
    return (
      <OnboardingPanelHook>
        <PlatformPickerPanel onSelect={navigateToPlatformGuide} />
      </OnboardingPanelHook>
    );
  }

  const platformText = CRON_SDK_PLATFORMS.find(
    ({platform: sdkPlatform}) => sdkPlatform === platform
  )?.label;

  const guides = platformGuides[platform];

  return (
    <OnboardingPanelHook>
      <Panel>
        <BackButton
          icon={<IconChevron direction="left" />}
          onClick={() => navigateToPlatformGuide(null)}
          borderless
        >
          {t('Back to Platforms')}
        </BackButton>
        <PanelBody withPadding>
          <h3>{t('Get Started with %s', platformText)}</h3>
          <Tabs
            onChange={guideKey => navigateToPlatformGuide(platform, guideKey)}
            value={guide}
          >
            <TabList>
              {[
                ...guides.map(({key, title}) => (
                  <TabList.Item key={key}>{title}</TabList.Item>
                )),
                <TabList.Item key={GuideKey.MANUAL}>{t('Manual')}</TabList.Item>,
              ]}
            </TabList>
            <TabPanels>
              {[
                ...guides.map(({key, Guide}) => (
                  <TabPanels.Item key={key}>
                    <GuideContainer>
                      <Guide />
                    </GuideContainer>
                  </TabPanels.Item>
                )),
                <TabPanels.Item key={GuideKey.MANUAL}>
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
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.subText};
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
