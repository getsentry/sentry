import ErrorBoundary from 'sentry/components/errorBoundary';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {ConnectedAutomationsList} from 'sentry/views/detectors/components/connectedAutomationList';

type Props = {
  detector: Detector;
};

export function DetectorDetailsAutomations({detector}: Props) {
  return (
    <Section title={t('Connected Automations')}>
      <ErrorBoundary mini>
        <ConnectedAutomationsList automationIds={detector.workflowIds} />
      </ErrorBoundary>
    </Section>
  );
}
