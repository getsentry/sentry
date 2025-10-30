import {useState} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {ConnectedAutomationsList} from 'sentry/views/detectors/components/connectedAutomationList';

type Props = {
  detector: Detector;
};

export function DetectorDetailsAutomations({detector}: Props) {
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  return (
    <Section title={t('Connected Alerts')}>
      <ErrorBoundary mini>
        <ConnectedAutomationsList
          automationIds={detector.workflowIds}
          cursor={cursor}
          onCursor={setCursor}
        />
      </ErrorBoundary>
    </Section>
  );
}
