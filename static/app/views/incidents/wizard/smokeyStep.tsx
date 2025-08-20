import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button/';
import {Heading, Text} from 'sentry/components/core/text';
import {IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';

interface SmokeyStepProps {
  onComplete: (stepId: string) => void;
}

export function SmokeyStep({onComplete}: SmokeyStepProps) {
  return (
    <StepContent>
      <Heading as="h3" size="lg">
        {t('Get to Know Smokey')}
      </Heading>
      <Text variant="muted">
        {t(
          'Smokey is your AI-powered incident management assistant. If you have Slack connected, you can interact with Smokey to get help during incidents.'
        )}
      </Text>
      <SmokeyDemo>
        <IconUser size="xl" />
        <Heading as="h4" size="md">
          Smokey Bot
        </Heading>
        <Text variant="muted">
          "Hi! I'm Smokey, your incident management assistant. I can help you create
          incidents, assign responders, and track progress."
        </Text>

        <ChatDemo>
          <ChatMessage>
            <strong>You:</strong> Create a new incident for API latency
          </ChatMessage>
          <ChatMessage>
            <strong>Smokey:</strong> I'll create a P2 incident for API latency. Who should
            I assign as the incident commander?
          </ChatMessage>
        </ChatDemo>
      </SmokeyDemo>

      <Button priority="primary" onClick={() => onComplete('smokey')}>
        {t('Continue')}
      </Button>
    </StepContent>
  );
}

const StepContent = styled('div')`
  max-width: 600px;
`;

const SmokeyDemo = styled('div')`
  text-align: center;
  padding: 2rem;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: 2rem;
`;

const ChatDemo = styled('div')`
  margin-top: 1.5rem;
  text-align: left;
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  padding: 1rem;
`;

const ChatMessage = styled('div')`
  margin-bottom: 0.75rem;
  font-size: 0.875rem;

  &:last-child {
    margin-bottom: 0;
  }
`;
