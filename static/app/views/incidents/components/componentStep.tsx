import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button/';
import {Input} from 'sentry/components/core/input';
import {Flex} from 'sentry/components/core/layout/flex';
import {Text} from 'sentry/components/core/text';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useIncidentComponents} from 'sentry/views/incidents/hooks/useIncidentComponents';

interface ComponentStepProps {
  onComplete: () => void;
}

export function ComponentStep({onComplete}: ComponentStepProps) {
  const organization = useOrganization();
  const {incidentComponents} = useIncidentComponents({
    organizationSlug: organization.slug,
  });

  return (
    <Flex gap="xl">
      <StepContent>
        <Text variant="muted">
          {t(
            'Components are the building blocks of your application that can experience issues. Add the key services, databases, and external dependencies that your team needs to monitor.'
          )}
        </Text>

        <Flex gap="sm">
          <Input
            size="sm"
            placeholder={t('e.g., API, Notifications, Payments, Mobile App')}
          />
          <Button size="sm" onClick={() => onComplete()}>
            {t('Add Component')}
          </Button>
        </Flex>
        <ComponentList>
          <ComponentItem>
            <span>API Gateway</span>
            <IconClose size="xs" />
          </ComponentItem>
          <ComponentItem>
            <span>User Database</span>
            <IconClose size="xs" />
          </ComponentItem>
        </ComponentList>
      </StepContent>
    </Flex>
  );
}

const StepContent = styled('div')`
  max-width: 600px;
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
