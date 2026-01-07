import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import onboardingImg from 'sentry-images/spot/onboarding-preview.svg';

import {Button} from 'sentry/components/core/button';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {IconGlobe, IconTerminal} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {platformGuides, type SupportedPlatform} from './upsertPlatformGuides';

interface Props {
  onSelect: (platform: SupportedPlatform | null) => void;
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
        {platformGuides
          .filter(({platform}) => !['cli', 'http'].includes(platform))
          .map(({platform, label}) => (
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
        <Button size="sm" icon={<IconTerminal />} onClick={() => onSelect('cli')}>
          Sentry CLI
        </Button>
        <Button size="sm" icon={<IconGlobe />} onClick={() => onSelect('http')}>
          HTTP (cURL)
        </Button>
      </Actions>
    </OnboardingPanel>
  );
}

const OnboardingTitle = styled('h3')`
  margin-bottom: ${space(1)};
`;

const SectionTitle = styled('h5')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
  text-transform: uppercase;
  margin-bottom: ${space(1)};
  margin-top: ${space(4)};
`;

const Actions = styled('div')`
  display: flex;
  gap: ${space(2)};
  flex-wrap: wrap;
`;

const PlatformButton = styled(Button)`
  width: 80px;
  height: 80px;
  padding: ${space(1.5)};
`;

const PlatformOption = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  align-items: center;
  color: ${p => p.theme.tokens.content.secondary};
`;
