import {useId} from 'react';
import styled from '@emotion/styled';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  MessagingIntegrationAnalyticsView,
  SetupMessagingIntegrationButton,
} from 'sentry/components/messagingIntegrations/setupMessagingIntegrationButton';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getIntegrationFeatureGate} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  type IssueAlertNotificationProps,
  MultipleCheckboxOptions,
  useIssueAlertNotificationOptions,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';

import type {ScmAnalyticsFlow} from './scmAnalyticsFlow';
import {ScmCollapsibleReveal} from './scmCollapsibleReveal';
import {ScmMessagingIntegrationAlertRule} from './scmMessagingIntegrationAlertRule';

/**
 * The plan feature the workflow action validator requires for a messaging
 * action. An org without it (e.g. one that installed an integration during a
 * trial and then downgraded) would fail the rule save, and the project it just
 * created would be rolled back, so the integration option is gated on it.
 */
const ALERT_RULE_INTEGRATION_FEATURES = [
  {featureGate: 'integrations-alert-rule', description: ''},
];

/**
 * SCM-styled notification options for the alert-frequency section. Mirrors
 * `IssueAlertNotificationOptions` but lifts the "Notify via" wording into a
 * shared header (so the checkboxes read just "Email" / "Integration ..."), and
 * renders the messaging rule stacked (`ScmMessagingIntegrationAlertRule`)
 * instead of the classic inline card.
 */
type Props = IssueAlertNotificationProps & {
  analyticsFlow: ScmAnalyticsFlow;
};

export function ScmIssueAlertNotificationOptions({analyticsFlow, ...props}: Props) {
  const {actions, setActions} = props;
  const organization = useOrganization();
  const {querySuccess, shouldRenderNotificationConfigs, shouldRenderSetupButton} =
    useIssueAlertNotificationOptions(props);

  const {IntegrationFeatures} = getIntegrationFeatureGate();

  const labelId = useId();

  if (!querySuccess) {
    return null;
  }

  return (
    <Stack gap="lg" padding="lg 0">
      <Text size="sm" bold variant="secondary" uppercase id={labelId}>
        {t('Notify via')}
      </Text>
      <Stack gap="md" width="100%" role="group" aria-labelledby={labelId}>
        <Stack gap="md">
          <Flex as="label" align="start" gap="md">
            <Checkbox checked disabled readOnly />
            <Text bold={false}>{t('Email')}</Text>
          </Flex>
          {shouldRenderSetupButton ? null : (
            <IntegrationFeatures
              organization={organization}
              features={ALERT_RULE_INTEGRATION_FEATURES}
            >
              {({disabled, disabledReason}) => (
                <Tooltip title={disabledReason} disabled={!disabled} skipWrapper>
                  <Flex as="label" align="start" gap="md">
                    <Checkbox
                      checked={actions.includes(MultipleCheckboxOptions.INTEGRATION)}
                      disabled={disabled}
                      onChange={e => {
                        setActions(
                          e.target.checked
                            ? [...actions, MultipleCheckboxOptions.INTEGRATION]
                            : actions.filter(
                                a => a !== MultipleCheckboxOptions.INTEGRATION
                              )
                        );
                        if (analyticsFlow === 'project-creation') {
                          trackAnalytics('project_creation.notify_integration_toggled', {
                            organization,
                            enabled: e.target.checked,
                            variant: 'scm',
                          });
                        }
                      }}
                    />
                    <Text bold={false} ellipsis>
                      {t('Integration (Slack, Discord, MS Teams, etc.)')}
                    </Text>
                  </Flex>
                </Tooltip>
              )}
            </IntegrationFeatures>
          )}
        </Stack>
        <ScmCollapsibleReveal
          open={!shouldRenderSetupButton && shouldRenderNotificationConfigs}
        >
          <IndentedRule>
            <ScmMessagingIntegrationAlertRule {...props} analyticsFlow={analyticsFlow} />
          </IndentedRule>
        </ScmCollapsibleReveal>
      </Stack>
      {shouldRenderSetupButton && (
        <SetupMessagingIntegrationButton
          analyticsView={
            analyticsFlow === 'project-creation'
              ? MessagingIntegrationAnalyticsView.PROJECT_CREATION
              : MessagingIntegrationAnalyticsView.ONBOARDING
          }
          variant="scm"
        />
      )}
    </Stack>
  );
}

// Indents the rule so its left edge lines up with the checkbox label text
// rather than the checkbox itself: the sm Checkbox box (16px) plus the label
// row's gap (space.md).
const IndentedRule = styled('div')`
  padding-left: calc(16px + ${p => p.theme.space.md});
`;
