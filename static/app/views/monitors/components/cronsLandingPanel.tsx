import {useEffect} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {TabList, TabPanels, Tabs} from 'sentry/components/tabs';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import MonitorCreateForm from 'sentry/views/monitors/components/monitorCreateForm';
import MonitorForm from 'sentry/views/monitors/components/monitorForm';
import {Monitor} from 'sentry/views/monitors/types';

import {
  CRON_SDK_PLATFORMS,
  PlatformPickerPanel,
  SupportedPlatform,
} from './platformPickerPanel';
import {
  CeleryBeatAutoDiscovery,
  GoUpsertPlatformGuide,
  JavaUpsertPlatformGuide,
  LaravelUpsertPlatformGuide,
  NodeJsUpsertPlatformGuide,
  PHPUpsertPlatformGuide,
  QuickStartProps,
  RubyUpsertPlatformGuide,
} from './quickStartEntries';

enum GuideKey {
  BEAT_AUTO = 'beat_auto',
  UPSERT = 'upsert',
  MANUAL = 'manual',
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
  'ruby-rails': [],
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
  const platform = decodeScalar(location.query?.platform) ?? null;
  const guide = decodeScalar(location.query?.guide);

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
      browserHistory.push({
        pathname: location.pathname,
        query: {...location.query, platform: undefined, guide: undefined},
      });
      return;
    }

    if (!selectedGuide) {
      selectedGuide = platformGuides[selectedPlatform][0]?.key ?? GuideKey.MANUAL;
    }
    browserHistory.push({
      pathname: location.pathname,
      query: {...location.query, platform: selectedPlatform, guide: selectedGuide},
    });
  };

  if (!isValidPlatform(platform) || !isValidGuide(guide)) {
    return <PlatformPickerPanel onSelect={navigateToPlatformGuide} />;
  }

  const platformText = CRON_SDK_PLATFORMS.find(
    ({platform: sdkPlatform}) => sdkPlatform === platform
  )?.label;

  const guides = platformGuides[platform];

  function onCreateMonitor(data: Monitor) {
    const url = normalizeUrl(`/organizations/${organization.slug}/crons/${data.slug}/`);
    browserHistory.push(url);
  }

  const hasNewOnboarding = organization.features.includes('crons-new-monitor-form');

  return (
    <Panel>
      <BackButton
        icon={<IconChevron size="sm" direction="left" />}
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
                  {hasNewOnboarding ? (
                    <MonitorCreateForm />
                  ) : (
                    <MonitorForm
                      apiMethod="POST"
                      apiEndpoint={`/organizations/${organization.slug}/monitors/`}
                      onSubmitSuccess={onCreateMonitor}
                      submitLabel={t('Next')}
                    />
                  )}
                </GuideContainer>
              </TabPanels.Item>,
            ]}
          </TabPanels>
        </Tabs>
      </PanelBody>
    </Panel>
  );
}

const BackButton = styled(Button)`
  font-weight: normal;
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
