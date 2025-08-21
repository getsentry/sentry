import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import type {IncidentCase} from 'sentry/views/incidents/types';
import {
  getIncidentSeverity,
  getSeverityColor,
  getStatusColor,
} from 'sentry/views/incidents/util';

export function CaseSeverityLabel({
  incidentCase,
  textSize = 'sm',
}: {
  incidentCase: IncidentCase;
  textSize?: 'xs' | 'sm' | 'md' | 'lg';
}) {
  return (
    <Flex
      padding="xs sm"
      border="primary"
      radius="2xl"
      style={{
        borderColor: getSeverityColor(incidentCase)?.border,
        background: getSeverityColor(incidentCase)?.background,
      }}
    >
      <Text
        size={textSize}
        variant="muted"
        style={{
          color: getSeverityColor(incidentCase)?.text,
        }}
        bold
      >
        {getIncidentSeverity(incidentCase)}
      </Text>
    </Flex>
  );
}

export function CaseStatusLabel({
  incidentCase,
  textSize = 'sm',
}: {
  incidentCase: IncidentCase;
  textSize?: 'xs' | 'sm' | 'md' | 'lg';
}) {
  return (
    <Flex
      padding="xs sm"
      border="primary"
      radius="2xl"
      style={{
        borderColor: getStatusColor(incidentCase.status as any)?.border,
        background: getStatusColor(incidentCase.status as any)?.background,
      }}
    >
      <Text
        size={textSize}
        variant="muted"
        style={{
          color: getStatusColor(incidentCase.status as any)?.text,
        }}
        bold
      >
        {incidentCase.status}
      </Text>
    </Flex>
  );
}
