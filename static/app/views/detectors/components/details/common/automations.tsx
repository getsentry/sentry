import ErrorBoundary from 'sentry/components/errorBoundary';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {ConnectedAutomationsList} from 'sentry/views/detectors/components/connectedAutomationList';

type Props = {
  detector: Detector;
};

export function DetectorDetailsAutomations({detector}: Props) {
  const location = useLocation();
  const navigate = useNavigate();

  const cursor =
    typeof location.query.cursor === 'string' ? location.query.cursor : undefined;

  return (
    <Section title={t('Connected Automations')}>
      <ErrorBoundary mini>
        <ConnectedAutomationsList
          automationIds={detector.workflowIds}
          cursor={cursor}
          onCursor={newCursor => {
            navigate({
              pathname: location.pathname,
              query: {
                ...location.query,
                cursor: newCursor,
              },
            });
          }}
        />
      </ErrorBoundary>
    </Section>
  );
}
