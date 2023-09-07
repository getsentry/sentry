import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import onboardingImg from 'sentry-images/spot/onboarding-preview.svg';

import OnboardingPanel from 'sentry/components/onboardingPanel';
import {PlatformKey} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {NewMonitorButton} from './newMonitorButton';

interface SDKPlatformInfo {
  label: string;
  platform: PlatformKey;
}

const CRON_SDK_PLATFORMS: SDKPlatformInfo[] = [
  {platform: 'python-celery', label: 'Celery'},
  {platform: 'php', label: 'PHP'},
  {platform: 'php-laravel', label: 'Laravel'},
  {platform: 'python', label: 'Python'},
  {platform: 'node', label: 'Node'},
];

export function PlatformPickerPanel() {
  return (
    <OnboardingPanel image={<img src={onboardingImg} />}>
      <OnboardingTitle>{t('Monitor Your Cron Jobs')}</OnboardingTitle>
      <p>
        {t(
          "We'll tell you if your recurring jobs are running on schedule, failing, or succeeding."
        )}
      </p>
      <SectionTitle>{t('Platforms')}</SectionTitle>
      <Actions>
        {CRON_SDK_PLATFORMS.map(({platform, label}) => (
          <PlatformOption key={platform}>
            <PlatformButton priority="default">
              <PlatformIcon platform={platform} format="lg" size="100%" />
            </PlatformButton>
            <div>{label}</div>
          </PlatformOption>
        ))}
      </Actions>
      <SectionTitle>{t('Generic')}</SectionTitle>
      <Actions>
        <NewMonitorButton size="sm" priority="default">
          Sentry CLI
        </NewMonitorButton>
        <NewMonitorButton size="sm" priority="default">
          HTTP (cURL)
        </NewMonitorButton>
      </Actions>
    </OnboardingPanel>
  );
}

const OnboardingTitle = styled('h3')`
  margin-bottom: ${space(1)};
`;

const SectionTitle = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  text-transform: uppercase;
  margin-bottom: ${space(1)};
  margin-top: ${space(4)};
`;

const Actions = styled('div')`
  display: flex;
  gap: ${space(2)};
`;

const PlatformButton = styled(NewMonitorButton)`
  width: 64px;
  height: 64px;
  padding: ${space(1)};
`;

const PlatformOption = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  align-items: center;
  color: ${p => p.theme.subText};
`;
