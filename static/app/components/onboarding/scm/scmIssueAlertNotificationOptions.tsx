import styled from '@emotion/styled';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {
  MessagingIntegrationAnalyticsView,
  SetupMessagingIntegrationButton,
} from 'sentry/views/alerts/rules/issue/setupMessagingIntegrationButton';
import {
  type IssueAlertNotificationProps,
  MultipleCheckboxOptions,
  useIssueAlertNotificationOptions,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';

import type {ScmAnalyticsFlow} from './scmAnalyticsFlow';
import {ScmCollapsibleReveal} from './scmCollapsibleReveal';
import {ScmMessagingIntegrationAlertRule} from './scmMessagingIntegrationAlertRule';

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
  const {querySuccess, shouldRenderNotificationConfigs, shouldRenderSetupButton} =
    useIssueAlertNotificationOptions(props);

  if (!querySuccess) {
    return null;
  }

  return (
    <Stack gap="lg" padding="lg 0">
      <Text size="sm" bold variant="secondary" uppercase>
        {t('Notify via')}
      </Text>
      <Stack gap="md" width="100%">
        <Stack gap="md">
          <Flex as="label" align="start" gap="md">
            <Checkbox checked disabled readOnly />
            <Text bold={false}>{t('Email')}</Text>
          </Flex>
          {shouldRenderSetupButton ? null : (
            <Flex as="label" align="start" gap="md">
              <Checkbox
                checked={actions.includes(MultipleCheckboxOptions.INTEGRATION)}
                onChange={e =>
                  setActions(
                    e.target.checked
                      ? [...actions, MultipleCheckboxOptions.INTEGRATION]
                      : actions.filter(a => a !== MultipleCheckboxOptions.INTEGRATION)
                  )
                }
              />
              <Text bold={false} ellipsis>
                {t('Integration (Slack, Discord, MS Teams, etc.)')}
              </Text>
            </Flex>
          )}
        </Stack>
        <ScmCollapsibleReveal
          open={!shouldRenderSetupButton && shouldRenderNotificationConfigs}
        >
          <IndentedRule>
            <ScmMessagingIntegrationAlertRule {...props} />
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
