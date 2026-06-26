import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {MultipleCheckbox} from 'sentry/components/forms/controls/multipleCheckbox';
import {t} from 'sentry/locale';
import {useRouteAnalyticsParams} from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {
  MessagingIntegrationAnalyticsView,
  SetupMessagingIntegrationButton,
} from 'sentry/views/alerts/rules/issue/setupMessagingIntegrationButton';
import {
  type IssueAlertNotificationProps,
  MultipleCheckboxOptions,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';

import {ScmCollapsibleReveal} from './scmCollapsibleReveal';
import {ScmMessagingIntegrationAlertRule} from './scmMessagingIntegrationAlertRule';

/**
 * SCM-styled notification options for the alert-frequency section. Mirrors
 * `IssueAlertNotificationOptions` but lifts the "Notify via" wording into a
 * shared header (so the checkboxes read just "Email" / "Integration ..."), and
 * renders the messaging rule stacked (`ScmMessagingIntegrationAlertRule`)
 * instead of the classic inline card.
 */
export function ScmIssueAlertNotificationOptions(props: IssueAlertNotificationProps) {
  const {actions, setActions, querySuccess, shouldRenderSetupButton} = props;

  const shouldRenderNotificationConfigs = actions.some(
    v => v !== MultipleCheckboxOptions.EMAIL
  );

  useRouteAnalyticsParams({
    setup_message_integration_button_shown: shouldRenderSetupButton,
  });

  if (!querySuccess) {
    return null;
  }

  return (
    <Stack gap="lg" padding="lg 0">
      <Text size="sm" bold variant="secondary" uppercase>
        {t('Notify via')}
      </Text>
      <MultipleCheckbox
        name="notification"
        value={actions}
        onChange={values => setActions(values)}
      >
        <Stack gap="md" width="100%">
          <CheckboxStack>
            <MultipleCheckbox.Item value={MultipleCheckboxOptions.EMAIL} disabled>
              {t('Email')}
            </MultipleCheckbox.Item>
            {shouldRenderSetupButton ? null : (
              <MultipleCheckbox.Item value={MultipleCheckboxOptions.INTEGRATION}>
                {t('Integration (Slack, Discord, MS Teams, etc.)')}
              </MultipleCheckbox.Item>
            )}
          </CheckboxStack>
          <ScmCollapsibleReveal
            open={!shouldRenderSetupButton && shouldRenderNotificationConfigs}
          >
            <IndentedRule>
              <ScmMessagingIntegrationAlertRule {...props} />
            </IndentedRule>
          </ScmCollapsibleReveal>
        </Stack>
      </MultipleCheckbox>
      {shouldRenderSetupButton && (
        <SetupMessagingIntegrationButton
          analyticsView={MessagingIntegrationAnalyticsView.PROJECT_CREATION}
        />
      )}
    </Stack>
  );
}

// MultipleCheckbox.Item's label is fixed at 20% width with nowrap text, tuned
// for the classic wrapping row layout. In this stacked layout the long
// integration label overflows on narrow screens, so let each label fill its
// row and truncate the text with an ellipsis instead.
const CheckboxStack = styled(Stack)`
  label {
    width: 100%;
    min-width: 0;
    /* The label's default right margin is for the side-by-side row layout; with
       a full-width label it would push 10px past the container. */
    margin-right: 0;
  }
  label > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

// Indents the rule so its left edge lines up with the checkbox label text
// rather than the checkbox itself: the sm Checkbox box (16px) plus the label's
// left margin (space.md).
const IndentedRule = styled('div')`
  padding-left: calc(16px + ${p => p.theme.space.md});
`;
