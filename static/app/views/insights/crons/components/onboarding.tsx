import styled from '@emotion/styled';

import {ExternalLink} from 'sentry/components/core/link';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {t, tct} from 'sentry/locale';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';
import type {Monitor} from 'sentry/views/insights/crons/types';

import MonitorQuickStartGuide from './monitorQuickStartGuide';

interface Props {
  monitor: Monitor;
}

export function MonitorOnboarding({monitor}: Props) {
  return (
    <OnboardingPanel noCenter>
      <h3>{t('Instrument your monitor')}</h3>
      <p>
        {tct(
          'Select an integration method for your new monitor. For in-depth instructions on integrating Crons, view [docsLink:our complete documentation].',
          {
            docsLink: (
              <ExternalLink href="https://docs.sentry.io/product/crons/getting-started/" />
            ),
          }
        )}
      </p>
      <MonitorQuickStartGuide monitor={monitor} />
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
  color: ${p => p.theme.pink400};
`;

const WaitingHelpText = styled('small')`
  grid-column: 2;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

const WaitingIndicator = styled('div')`
  margin: 0 ${space(0.75)};
  ${pulsingIndicatorStyles};
`;
