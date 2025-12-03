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
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import MonitorCreateForm from 'sentry/views/insights/crons/components/monitorCreateForm';

import type {SupportedPlatform} from './platformPickerPanel';
import {
  CRON_GENERIC_PLATFORMS,
  CRON_SDK_PLATFORMS,
  PlatformPickerPanel,
} from './platformPickerPanel';
import {
  CeleryBeatAutoDiscovery,
  CLIUpsertPlatformGuide,
  CurlUpsertPlatformGuide,
  DenoUpsertPlatformGuide,
  DotNetUpsertPlatformGuide,
  ElixirObanPlatformGuide,
  ElixirQuantumPlatformGuide,
  ElixirUpsertPlatformGuide,
  GoUpsertPlatformGuide,
  JavaSpringBootUpsertPlatformGuide,
  JavaUpsertPlatformGuide,
  LaravelUpsertPlatformGuide,
  NestJSUpsertPlatformGuide,
  NextJSUpsertPlatformGuide,
  NodeJsUpsertPlatformGuide,
  PHPUpsertPlatformGuide,
  PythonUpsertPlatformGuide,
  RubyActiveJobPlatformGuide,
  RubyRailsMixinPlatformGuide,
  RubySidekiqAutoPlatformGuide,
  RubySidekiqMixinPlatformGuide,
  RubyUpsertPlatformGuide,
} from './upsertPlatformGuides';

enum GuideKey {
  UPSERT = 'upsert',
  MANUAL = 'manual',
  MIXIN = 'mixin',
  SIDEKIQ_AUTO = 'sidekiq_auto',
  SIDEKIQ_MIXIN = 'sidekiq_mixin',
  ACTIVEJOB = 'activejob',
  OBAN = 'oban',
  QUANTUM = 'quantum',
}

interface PlatformGuide {
  Guide: React.ComponentType<any>;
  key: GuideKey;
  title: string;
}

const platformGuides: Record<SupportedPlatform, PlatformGuide[]> = {
  'python-celery': [
    {
      Guide: CeleryBeatAutoDiscovery,
      title: 'Auto-Instrument',
      key: GuideKey.UPSERT,
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
  python: [
    {
      Guide: PythonUpsertPlatformGuide,
      title: 'Upsert',
      key: GuideKey.UPSERT,
    },
  ],
  node: [
    {
      Guide: NodeJsUpsertPlatformGuide,
      title: 'Upsert',
      key: GuideKey.UPSERT,
    },
  ],
  deno: [
    {
      Guide: DenoUpsertPlatformGuide,
      title: 'Auto-Instrument',
      key: GuideKey.UPSERT,
    },
  ],
  'node-nestjs': [
    {
      Guide: NestJSUpsertPlatformGuide,
      title: 'Upsert',
      key: GuideKey.UPSERT,
    },
  ],
  'node-nextjs': [
    {
      Guide: NextJSUpsertPlatformGuide,
      title: 'Auto-Instrument',
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
  'java-spring-boot': [
    {
      Guide: JavaSpringBootUpsertPlatformGuide,
      title: 'Auto-Instrument',
      key: GuideKey.UPSERT,
    },
  ],
  ruby: [
    {
      Guide: RubyUpsertPlatformGuide,
      title: 'Upsert',
      key: GuideKey.UPSERT,
    },
    {
      Guide: RubySidekiqMixinPlatformGuide,
      title: 'Sidekiq Mixin',
      key: GuideKey.SIDEKIQ_MIXIN,
    },
  ],
  'ruby-rails': [
    {
      Guide: RubySidekiqAutoPlatformGuide,
      title: 'Sidekiq Auto Discovery',
      key: GuideKey.SIDEKIQ_AUTO,
    },
    {
      Guide: RubyActiveJobPlatformGuide,
      title: 'ActiveJob',
      key: GuideKey.ACTIVEJOB,
    },
    {
      Guide: RubyRailsMixinPlatformGuide,
      title: 'Mixin',
      key: GuideKey.MIXIN,
    },
  ],
  elixir: [
    {
      Guide: ElixirUpsertPlatformGuide,
      title: 'Upsert',
      key: GuideKey.UPSERT,
    },
    {
      Guide: ElixirObanPlatformGuide,
      title: 'Oban',
      key: GuideKey.OBAN,
    },
    {
      Guide: ElixirQuantumPlatformGuide,
      title: 'Quantum',
      key: GuideKey.QUANTUM,
    },
  ],
  dotnet: [
    {
      Guide: DotNetUpsertPlatformGuide,
      title: 'Upsert',
      key: GuideKey.UPSERT,
    },
  ],
  cli: [
    {
      Guide: CLIUpsertPlatformGuide,
      title: 'Upsert',
      key: GuideKey.UPSERT,
    },
  ],
  http: [
    {
      Guide: CurlUpsertPlatformGuide,
      title: 'Upsert',
      key: GuideKey.UPSERT,
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

  const platformText =
    CRON_SDK_PLATFORMS.find(p => p.platform === platform)?.label ??
    CRON_GENERIC_PLATFORMS.find(p => p.platform === platform)?.label ??
    platform;

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
  font-weight: ${p => p.theme.fontWeight.normal};
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
