import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button/';
import {Heading, Text} from 'sentry/components/core/text';
import {t} from 'sentry/locale';

interface DemoStepProps {
  onComplete: (stepId: string) => void;
}

export function DemoStep({onComplete}: DemoStepProps) {
  return (
    <StepContent>
      <Heading as="h3" size="lg">
        {t('Test It Out')}
      </Heading>
      <Text variant="muted">
        {t(
          'Create a demo incident to verify your setup works correctly. This will help you understand the flow and identify any issues.'
        )}
      </Text>

      <DemoIncident>
        <Heading as="h4" size="md">
          Demo Incident: Test API Response
        </Heading>
        <Text variant="muted">This is a test incident to verify your setup</Text>

        <IncidentActions>
          <Button size="sm" priority="primary">
            Start Incident
          </Button>
          <Button size="sm">Assign Responders</Button>
          <Button size="sm">Update Status</Button>
        </IncidentActions>
      </DemoIncident>

      <Button priority="primary" onClick={() => onComplete('test')}>
        {t('Complete Setup')}
      </Button>
    </StepContent>
  );
}

const StepContent = styled('div')`
  max-width: 600px;
`;

const DemoIncident = styled('div')`
  padding: 1.5rem;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: 2rem;
`;

const IncidentActions = styled('div')`
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
`;
