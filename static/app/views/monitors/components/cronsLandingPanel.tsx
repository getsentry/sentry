import {useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import onboardingImg from 'sentry-images/spot/onboarding-preview.svg';

import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {TabList, TabPanels, Tabs} from 'sentry/components/tabs';
import {PlatformKey} from 'sentry/data/platformCategories';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import MonitorForm from 'sentry/views/monitors/components/monitorForm';
import {Monitor} from 'sentry/views/monitors/types';

import {NewMonitorButton} from './newMonitorButton';
import {
  CRON_SDK_PLATFORMS,
  PlatformPickerPanel,
  SupportedPlatform,
} from './platformPickerPanel';
import {
  CeleryBeatAutoDiscovery,
  LaravelUpsertPlatformGuide,
  NodeJsUpsertPlatformGuide,
  PHPUpsertPlatformGuide,
  QuickStartProps,
} from './quickStartEntries';

interface PlatformGuide {
  Guide: React.ComponentType<QuickStartProps>;
  title: string;
}

const platformGuides: Record<SupportedPlatform, PlatformGuide[]> = {
  'python-celery': [
    {
      Guide: CeleryBeatAutoDiscovery,
      title: 'Beat Auto Discovery',
    },
  ],
  php: [
    {
      Guide: PHPUpsertPlatformGuide,
      title: 'Upsert',
    },
  ],
  'php-laravel': [
    {
      Guide: LaravelUpsertPlatformGuide,
      title: 'Upsert',
    },
  ],
  python: [],
  node: [
    {
      Guide: NodeJsUpsertPlatformGuide,
      title: 'Upsert',
    },
  ],
};

export function CronsLandingPanel() {
  const organization = useOrganization();
  const [platform, setPlatform] = useState<PlatformKey | null>(null);

  if (!platform) {
    return <PlatformPickerPanel onSelect={setPlatform} />;
  }

  const platformText = CRON_SDK_PLATFORMS.find(
    ({platform: sdkPlatform}) => sdkPlatform === platform
  )?.label;

  const guides = platformGuides[platform];

  function onCreateMonitor(data: Monitor) {
    const url = normalizeUrl(`/organizations/${organization.slug}/crons/${data.slug}/`);
    browserHistory.push(url);
  }

  return (
    <Panel>
      <BackButton
        icon={<IconChevron size="sm" direction="left" />}
        onClick={() => setPlatform(null)}
        borderless
      >
        {t('Back to Platforms')}
      </BackButton>
      <PanelBody withPadding>
        <h3>{t('Get Started with %s', platformText)}</h3>
        <Tabs>
          <TabList>
            {[
              ...guides.map(({title}) => (
                <TabList.Item key={title}>{title}</TabList.Item>
              )),
              <TabList.Item key="manual">{t('Manual')}</TabList.Item>,
            ]}
          </TabList>
          <TabPanels>
            {[
              ...guides.map(({title, Guide}) => (
                <TabPanels.Item key={title}>
                  <GuideContainer>
                    <Guide />
                  </GuideContainer>
                </TabPanels.Item>
              )),
              <TabPanels.Item key="manual">
                <GuideContainer>
                  <MonitorForm
                    apiMethod="POST"
                    apiEndpoint={`/organizations/${organization.slug}/monitors/`}
                    onSubmitSuccess={onCreateMonitor}
                    submitLabel={t('Next')}
                  />
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

export function OldCronsLandingPanel() {
  return (
    <OnboardingPanel image={<img src={onboardingImg} />}>
      <h3>{t('Let Sentry monitor your recurring jobs')}</h3>
      <p>
        {t(
          "We'll tell you if your recurring jobs are running on schedule, failing, or succeeding."
        )}
      </p>
      <OnboardingActions gap={1}>
        <NewMonitorButton>{t('Set up first cron monitor')}</NewMonitorButton>
        <LinkButton href="https://docs.sentry.io/product/crons" external>
          {t('Read docs')}
        </LinkButton>
      </OnboardingActions>
    </OnboardingPanel>
  );
}

const OnboardingActions = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;
