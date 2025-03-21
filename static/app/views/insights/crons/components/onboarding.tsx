import ExternalLink from 'sentry/components/links/externalLink';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import {t, tct} from 'sentry/locale';

import type {Monitor} from '../types';

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
    </OnboardingPanel>
  );
}
