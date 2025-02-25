import styled from '@emotion/styled';

import type {PromptResponse} from 'sentry/actionCreators/prompts';
import {
  makePromptsCheckQueryKey,
  promptsUpdate,
  usePromptsCheck,
} from 'sentry/actionCreators/prompts';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Alert} from 'sentry/components/core/alert/alert';
import {IconClose, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {promptIsDismissed} from 'sentry/utils/promptIsDismissed';
import {setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {ruleNeedsErrorMigration} from 'sentry/views/alerts/utils/migrationUi';

interface ErrorMigrationWarningProps {
  project?: Project;
  rule?: MetricRule;
}

const METRIC_ALERT_IGNORE_ARCHIVED_ISSUES = 'metric_alert_ignore_archived_issues';

function createdOrModifiedAfterMigration(rule: MetricRule) {
  const migrationDate = new Date('2023-12-11T00:00:00Z').getTime();
  return (
    (rule.dateCreated && new Date(rule.dateCreated).getTime() > migrationDate) ||
    (rule.dateModified && new Date(rule.dateModified).getTime() > migrationDate)
  );
}

/**
 * Displays a message to filter events from archived issues when the metric alert
 * is counting error events.
 */
export function ErrorMigrationWarning({project, rule}: ErrorMigrationWarningProps) {
  const api = useApi();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const showErrorMigrationWarning = rule && ruleNeedsErrorMigration(rule);
  const isCreatedAfterMigration = rule && createdOrModifiedAfterMigration(rule);
  const prompt = usePromptsCheck(
    {
      organization,
      feature: METRIC_ALERT_IGNORE_ARCHIVED_ISSUES,
      projectId: project?.id,
    },
    {staleTime: Infinity, enabled: showErrorMigrationWarning && !isCreatedAfterMigration}
  );

  const isPromptDismissed =
    prompt.isSuccess && prompt.data.data
      ? promptIsDismissed({
          dismissedTime: prompt.data.data.dismissed_ts,
          snoozedTime: prompt.data.data.snoozed_ts,
        })
      : false;

  if (
    !showErrorMigrationWarning ||
    !rule ||
    isPromptDismissed ||
    isCreatedAfterMigration
  ) {
    return null;
  }

  const dismissPrompt = () => {
    promptsUpdate(api, {
      organization,
      projectId: project?.id,
      feature: METRIC_ALERT_IGNORE_ARCHIVED_ISSUES,
      status: 'dismissed',
    });

    // Update cached query data, set to dismissed
    setApiQueryData<PromptResponse>(
      queryClient,
      makePromptsCheckQueryKey({
        organization,
        feature: METRIC_ALERT_IGNORE_ARCHIVED_ISSUES,
        projectId: project?.id,
      }),
      () => {
        const dimissedTs = new Date().getTime() / 1000;
        return {
          data: {dismissed_ts: dimissedTs},
          features: {[METRIC_ALERT_IGNORE_ARCHIVED_ISSUES]: {dismissed_ts: dimissedTs}},
        };
      }
    );
  };

  return (
    <Alert.Container>
      <Alert
        type="warning"
        showIcon
        trailingItems={
          <ButtonBar gap={1}>
            <LinkButton
              to={{
                pathname: `/organizations/${organization.slug}/alerts/metric-rules/${
                  project?.slug ?? rule?.projects?.[0]
                }/${rule.id}/`,
                query: {migration: '1'},
              }}
              size="xs"
              icon={<IconEdit />}
            >
              {t('Exclude archived issues')}
            </LinkButton>
            <DismissButton
              priority="link"
              icon={<IconClose />}
              onClick={dismissPrompt}
              aria-label={t('Dismiss Alert')}
              title={t('Dismiss Alert')}
            />
          </ButtonBar>
        }
      >
        {t(
          "Alert rules can now exclude errors associated with archived issues. Please make sure to review the rule's alert thresholds after editing."
        )}
      </Alert>
    </Alert.Container>
  );
}

const DismissButton = styled(Button)`
  color: ${p => p.theme.alert.warning.color};
  pointer-events: all;
  &:hover {
    opacity: 0.5;
  }
`;
