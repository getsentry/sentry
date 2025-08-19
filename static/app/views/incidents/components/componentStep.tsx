import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button/';
import {Heading, Text} from 'sentry/components/core/text';
import {IconClose, IconDashboard} from 'sentry/icons';
import {t} from 'sentry/locale';

interface ComponentStepProps {
  onComplete: (stepId: string) => void;
}

export function ComponentStep({onComplete}: ComponentStepProps) {
  return (
    <StepContent>
      <Heading as="h3" size="lg">
        {t('Add Components')}
      </Heading>
      <Text variant="muted">
        {t(
          'Components are the building blocks of your application that can experience issues. Add the key services, databases, and external dependencies that your team needs to monitor.'
        )}
      </Text>

      <ComponentForm>
        <ComponentInput
          placeholder={t('e.g., API Gateway, User Database, Payment Service')}
        />
        <Button size="sm" onClick={() => onComplete('components')}>
          {t('Add Component')}
        </Button>
      </ComponentForm>

      <ComponentList>
        <ComponentItem>
          <IconDashboard size="sm" />
          <span>API Gateway</span>
          <IconClose size="xs" />
        </ComponentItem>
        <ComponentItem>
          <IconDashboard size="sm" />
          <span>User Database</span>
          <IconClose size="xs" />
        </ComponentItem>
      </ComponentList>
    </StepContent>
  );
}

const StepContent = styled('div')`
  max-width: 600px;
`;

const ComponentForm = styled('div')`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const ComponentInput = styled('input')`
  flex: 1;
  padding: 0.5rem;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  font-size: 0.875rem;
`;

const ComponentList = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const ComponentItem = styled('div')`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  font-size: 0.875rem;

  svg:last-child {
    margin-left: auto;
    cursor: pointer;
    color: ${p => p.theme.subText};

    &:hover {
      color: ${p => p.theme.textColor};
    }
  }
`;
