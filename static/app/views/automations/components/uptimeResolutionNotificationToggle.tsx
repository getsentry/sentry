import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import ExternalLink from 'sentry/components/links/externalLink';
import {IconCheckmark, IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import {useAutomationBuilderContext} from 'sentry/views/automations/components/automationBuilderContext';
import {useConnectedDetectors} from 'sentry/views/automations/hooks/useConnectedDetectors';

/**
 * Component that provides guidance for configuring resolution notifications
 * for uptime monitors. Shows users how to use the ISSUE_PRIORITY_DEESCALATING
 * condition to get notified when uptime monitors are resolved.
 */
export function UptimeResolutionNotificationToggle() {
  const {connectedDetectors} = useConnectedDetectors();
  const {state} = useAutomationBuilderContext();

  // Only show this if connected to at least one uptime detector
  const hasUptimeDetectors = connectedDetectors.some(
    d => d.type === 'uptime_domain_failure'
  );

  // Check if resolution notifications are currently configured
  const hasResolutionFilter = state.actionFilters.some(filter =>
    filter.conditions.some(
      cond => cond.type === DataConditionType.ISSUE_PRIORITY_DEESCALATING
    )
  );

  if (!hasUptimeDetectors) {
    return null;
  }

  return (
    <UptimeResolutionContainer>
      {hasResolutionFilter ? (
        <Alert variant="success" icon={<IconCheckmark />}>
          <Flex direction="column" gap="xs">
            <Text bold>{t('Resolution notifications are configured')}</Text>
            <Text size="sm">
              {t(
                'This automation will send notifications when uptime monitor outages are resolved.'
              )}
            </Text>
          </Flex>
        </Alert>
      ) : (
        <Alert variant="info" icon={<IconInfo />}>
          <Flex direction="column" gap="xs">
            <Text bold>
              {t('Want to be notified when uptime monitor outages are resolved?')}
            </Text>
            <Text size="sm">
              {tct(
                'Add an If/Then block with [condition] to be notified on recovery. [link:Learn more]',
                {
                  condition: <strong>{t('"The issue priority de-escalates"')}</strong>,
                  link: <ExternalLink href="https://docs.sentry.io/product/alerts/uptime-monitoring/" />,
                }
              )}
            </Text>
          </Flex>
        </Alert>
      )}
    </UptimeResolutionContainer>
  );
}

const UptimeResolutionContainer = styled('div')`
  margin-top: ${space(2)};
  margin-bottom: ${space(2)};
`;
