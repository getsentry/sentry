import styled from '@emotion/styled';

import OnboardingPanel from 'sentry/components/onboardingPanel';
import {t} from 'sentry/locale';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';

import MonitorQuickStartGuide from './monitorQuickStartGuide';

interface Props {
  monitorSlug: string;
  project: Project;
}

export function MonitorOnboarding({monitorSlug, project}: Props) {
  return (
    <OnboardingPanel noCenter>
      <h3>{t('Instrument your monitor')}</h3>
      <MonitorQuickStartGuide monitorSlug={monitorSlug} project={project} />
      <WaitingNotice>
        <WaitingIndicator />
        {t('Waiting for first Check-in')}
        <WaitingHelpText>
          {t(
            'This Cron Monitor will not detect misses until the first Check-in has been received.'
          )}
        </WaitingHelpText>
      </WaitingNotice>
    </OnboardingPanel>
  );
}

const WaitingNotice = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: center;
  gap: ${space(0.25)} ${space(0.5)};
  margin-top: ${space(2)};
  color: ${p => p.theme.colors.pink500};
`;

const WaitingHelpText = styled('small')`
  grid-column: 2;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
`;

const WaitingIndicator = styled('div')`
  margin: 0 ${space(0.75)};
  ${pulsingIndicatorStyles};
`;
