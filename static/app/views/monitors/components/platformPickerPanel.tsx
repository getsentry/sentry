import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import onboardingImg from 'sentry-images/spot/onboarding-preview.svg';

import {Button} from 'sentry/components/button';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {PlatformKey} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {NewMonitorButton} from './newMonitorButton';

export type SupportedPlatform =
  | 'python-celery'
  | 'php'
  | 'php-laravel'
  | 'python'
  | 'node';

interface SDKPlatformInfo {
  label: string;
  platform: SupportedPlatform;
}

export const CRON_SDK_PLATFORMS: SDKPlatformInfo[] = [
  {platform: 'python-celery', label: 'Celery'},
  {platform: 'php', label: 'PHP'},
  {platform: 'php-laravel', label: 'Laravel'},
  {platform: 'python', label: 'Python'},
  {platform: 'node', label: 'Node'},
];

interface Props {
  onSelect: (platform: PlatformKey) => void;
}

export function PlatformPickerPanel({onSelect}: Props) {
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
            <PlatformButton
              priority="default"
              onClick={() => onSelect(platform)}
              aria-label={t('Create %s Monitor', platform)}
            >
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

const SectionTitle = styled('h5')`
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

const PlatformButton = styled(Button)`
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
