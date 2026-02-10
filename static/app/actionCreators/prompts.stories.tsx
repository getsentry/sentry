import {Fragment} from 'react';
import {useQueryState} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {PromptFeature} from 'sentry/actionCreators/prompts';
import {usePrompt} from 'sentry/actionCreators/prompts';
import * as Storybook from 'sentry/stories';
import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

export const ALL_PROMPTS: PromptFeature[] = [
  'alert_stream',
  'attachments_overage_alert',
  'attachments_product_trial_alert',
  'attachments_warning_alert',
  'data_consent_banner',
  'data_consent_priority',
  'deactivated_member_alert',
  'errors_overage_alert',
  'errors_product_trial_alert',
  'errors_warning_alert',
  'forced_trial_notice',
  'github_missing_members',
  'installable_builds_overage_alert',
  'installable_builds_product_trial_alert',
  'installable_builds_warning_alert',
  'issue_feedback_hidden',
  'issue_priority',
  'issue_replay_inline_onboarding',
  'issue_views_all_views_banner',
  'log_bytes_overage_alert',
  'log_bytes_product_trial_alert',
  'log_bytes_warning_alert',
  'log_items_overage_alert',
  'log_items_product_trial_alert',
  'log_items_warning_alert',
  'metric_alert_ignore_archived_issues',
  'monitor_seats_overage_alert',
  'monitor_seats_product_trial_alert',
  'monitor_seats_warning_alert',
  'monitors_overage_alert',
  'monitors_product_trial_alert',
  'monitors_warning_alert',
  'partner_plan_ending_modal',
  'profile_chunks_overage_alert',
  'profile_chunks_product_trial_alert',
  'profile_chunks_ui_overage_alert',
  'profile_chunks_ui_product_trial_alert',
  'profile_chunks_ui_warning_alert',
  'profile_chunks_warning_alert',
  'profile_duration_uis_overage_alert',
  'profile_duration_uis_product_trial_alert',
  'profile_duration_uis_warning_alert',
  'profile_durations_overage_alert',
  'profile_durations_product_trial_alert',
  'profile_durations_warning_alert',
  'profiles_indexed_overage_alert',
  'profiles_indexed_product_trial_alert',
  'profiles_indexed_warning_alert',
  'profiles_overage_alert',
  'profiles_product_trial_alert',
  'profiles_warning_alert',
  'replays_overage_alert',
  'replays_product_trial_alert',
  'replays_warning_alert',
  'seer_autofix_overage_alert',
  'seer_autofix_product_trial_alert',
  'seer_autofix_setup_acknowledged',
  'seer_autofix_warning_alert',
  'seer_scanner_overage_alert',
  'seer_scanner_product_trial_alert',
  'seer_scanner_warning_alert',
  'seer_users_overage_alert',
  'seer_users_product_trial_alert',
  'seer_users_warning_alert',
  'size_analyses_overage_alert',
  'size_analyses_product_trial_alert',
  'size_analyses_warning_alert',
  'spans_indexed_overage_alert',
  'spans_indexed_product_trial_alert',
  'spans_indexed_warning_alert',
  'spans_overage_alert',
  'spans_product_trial_alert',
  'spans_warning_alert',
  'stacktrace_link',
  'subscription_try_business_banner',
  'trace_metrics_overage_alert',
  'trace_metrics_product_trial_alert',
  'trace_metrics_warning_alert',
  'transactions_indexed_overage_alert',
  'transactions_indexed_product_trial_alert',
  'transactions_indexed_warning_alert',
  'transactions_overage_alert',
  'transactions_processed_overage_alert',
  'transactions_processed_product_trial_alert',
  'transactions_processed_warning_alert',
  'transactions_product_trial_alert',
  'transactions_warning_alert',
  'trial_ended_notice',
  'uptime_overage_alert',
  'uptime_product_trial_alert',
  'uptime_warning_alert',
  'user_snooze_deprecation',
];

export default Storybook.story('Prompts', story => {
  story('Basics', () => {
    const [projectId, setProjectId] = useQueryState('projectId');
    const {projects} = useProjects();
    return (
      <Flex gap="md" align="center">
        <Text size="lg" bold>
          Project:
        </Text>
        <CompactSelect
          options={projects.map(project => ({label: project.slug, value: project.id}))}
          onChange={selected => setProjectId(String(selected.value))}
          value={projectId ?? ''}
        />
      </Flex>
    );
  });

  story('List them all', () => {
    const organization = useOrganization();
    const [projectId] = useQueryState('projectId');

    if (!projectId) {
      return <Text variant="warning">No project selected</Text>;
    }
    return (
      <Fragment>
        <Grid gap="md" columns="repeat(5, max-content)">
          {ALL_PROMPTS.map(prompt => (
            <PromptFeatureItem
              key={prompt}
              feature={prompt}
              organization={organization}
              projectId={projectId ?? ''}
            />
          ))}
        </Grid>
      </Fragment>
    );
  });
});

function PromptFeatureItem({
  feature,
  organization,
  projectId,
}: {
  feature: PromptFeature;
  organization: Organization;
  projectId: string;
}) {
  const {isPromptDismissed, dismissPrompt, snoozePrompt, showPrompt} = usePrompt({
    feature,
    organization,
    projectId,
  });

  return (
    <Fragment>
      <Text>{feature}</Text>
      <Text>{isPromptDismissed ? 'Dismissed' : 'Not dismissed'}</Text>
      <Button size="xs" onClick={dismissPrompt}>
        Dismiss
      </Button>
      <Button size="xs" onClick={snoozePrompt}>
        Snooze
      </Button>
      <Button size="xs" onClick={showPrompt}>
        Show
      </Button>
    </Fragment>
  );
}
