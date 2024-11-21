import type {GuidesContent} from 'sentry/components/assistant/types';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {isDemoModeEnabled} from 'sentry/utils/demoMode';
import {hasMetricsNewInputs} from 'sentry/utils/metrics/features';

export default function getGuidesContent(
  organization: Organization | null
): GuidesContent {
  if (isDemoModeEnabled()) {
    return getDemoModeGuides();
  }
  return [
    {
      guide: 'issue',
      requiredTargets: ['issue_header_stats', 'breadcrumbs', 'issue_sidebar_owners'],
      steps: [
        {
          title: t('How bad is it?'),
          target: 'issue_header_stats',
          description: t(
            `You have Issues and that's fine.
              Understand impact at a glance by viewing total issue frequency and affected users.`
          ),
        },
        {
          title: t('Find problematic releases'),
          target: 'issue_sidebar_releases',
          description: t(
            `See which release introduced the issue and which release it last appeared in.`
          ),
        },
        {
          title: t('Not your typical stack trace'),
          target: 'stacktrace',
          description: t(
            `Sentry can show your source code in the stack trace.
              See the exact sequence of function calls leading to the error in question.`
          ),
        },
        {
          // TODO(streamline-ui): Remove from guides on GA, tag sidebar is gone
          title: t('Pinpoint hotspots'),
          target: 'issue_sidebar_tags',
          description: t(
            `Tags are key/value string pairs that are automatically indexed and searchable in Sentry.`
          ),
        },
        {
          title: t('Retrace Your Steps'),
          target: 'breadcrumbs',
          description: t(
            `Not sure how you got here? Sentry automatically captures breadcrumbs for
              events your user and app took that led to the error.`
          ),
        },
        {
          title: t('Annoy the Right People'),
          target: 'issue_sidebar_owners',
          description: t(
            `Automatically assign issues to the person who introduced the commit,
              notify them over notification tools like Slack,
              and triage through issue management tools like Jira. `
          ),
        },
      ],
    },
    {
      guide: 'issue_stream',
      requiredTargets: ['issue_stream'],
      steps: [
        {
          title: t('Issues'),
          target: 'issue_stream',
          description: tct(
            `Sentry automatically groups similar events together into an issue. Similarity is
            determined by stack trace and other factors. [link:Learn more].`,
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platform-redirect/?next=/data-management/event-grouping/" />
              ),
            }
          ),
        },
      ],
    },
    {
      guide: 'alerts_write_owner',
      requiredTargets: ['alerts_write_owner'],
      steps: [
        {
          target: 'alerts_write_owner',
          description: tct(
            `Today only admins in your organization can create alert rules but we recommend [link:allowing members to create alerts], too.`,
            {
              link: (
                <Link
                  to={organization?.slug ? `/settings/${organization.slug}` : `/settings`}
                />
              ),
            }
          ),
          nextText: t('Allow'),
          hasNextGuide: true,
        },
      ],
    },
    {
      guide: 'trace_view',
      requiredTargets: ['trace_view_guide_row', 'trace_view_guide_row_details'],
      steps: [
        {
          title: t('Event Breakdown'),
          target: 'trace_view_guide_breakdown',
          description: t(
            `The event breakdown shows you the breakdown of event types within a trace.`
          ),
        },
        {
          title: t('Events'),
          target: 'trace_view_guide_row',
          description: t(
            `You can quickly see errors and transactions in a trace alongside the project, transaction duration and any errors or performance issues related to the transaction.`
          ),
        },
        {
          title: t('Event Details'),
          target: 'trace_view_guide_row_details',
          description: t('Click on any transaction or error row to see more details.'),
        },
      ],
    },
    {
      guide: 'span_op_breakdowns_and_tag_explorer',
      requiredTargets: ['span_op_breakdowns_filter'],
      steps: [
        {
          title: t('Filter by Span Operation'),
          target: 'span_op_breakdowns_filter',
          description: t(
            'You can now filter these transaction events based on http, db, browser or resource operation.'
          ),
        },
        {
          title: t('Suspect Tags'),
          target: 'tag_explorer',
          description: tct(
            "See which tags often correspond to slower transactions. You'll want to investigate these more. [link:Learn more]",
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/performance/transaction-summary/#suspect-tags" />
              ),
            }
          ),
        },
      ],
    },
    {
      guide: 'project_transaction_threshold',
      requiredTargets: ['project_transaction_threshold'],
      steps: [
        {
          title: t('Project Thresholds'),
          target: 'project_transaction_threshold',
          description: t(
            'Gauge performance using different metrics for each project. Set response time thresholds, per project, for the Apdex and User Misery Scores in each project’s Performance settings.'
          ),
        },
      ],
    },
    {
      guide: 'project_transaction_threshold_override',
      requiredTargets: ['project_transaction_threshold_override'],
      steps: [
        {
          title: t('Response Time Thresholds'),
          target: 'project_transaction_threshold_override',
          description: t(
            'Use this menu to adjust each transaction’s satisfactory response time threshold, which can vary across transactions. These thresholds are used to calculate Apdex and User Misery, metrics that indicate how satisfied and miserable users are, respectively.'
          ),
        },
      ],
    },
    {
      guide: 'metrics_onboarding',
      requiredTargets: ['metrics_onboarding'],
      steps: [
        {
          title: t('Metrics Selector'),
          target: 'metrics_selector',
          description: t('Your metrics are available here.'),
        },
        {
          title: t('Aggregate Metrics'),
          target: 'metrics_aggregate',
          description: t('See different facets of your metric through aggregations.'),
        },
        ...(organization && hasMetricsNewInputs(organization)
          ? [
              {
                title: t('Grouping'),
                target: 'metrics_groupby',
                description: t('Segment your data by the tags you’ve attached.'),
              },
              {
                title: t('Filtering'),
                target: 'metrics_filterby',
                description: t('Filter your data by the tags you’ve attached.'),
              },
            ]
          : [
              {
                title: t('Grouping & Filtering'),
                target: 'metrics_groupby',
                description: t(
                  'Segment or filter your data by the tags you’ve attached.'
                ),
              },
            ]),
        {
          title: t('Multiple Metrics'),
          target: 'add_metric_query',
          description: t('Plot a second metric to see correlations.'),
        },
        {
          title: t('Visualization'),
          target: 'metrics_chart',
          description: t(
            'View plotted metrics, dots on the chart represent associated sample spans.'
          ),
        },
        {
          title: t('Span Samples'),
          target: 'metrics_table',
          description: tct(
            'See sample spans summarized in a table format. [openInTraces]',
            {
              openInTraces:
                organization?.features.includes(
                  'performance-trace-explorer-with-metrics'
                ) && organization?.features.includes('performance-trace-explorer')
                  ? t('To filter by tags found only on spans, click "Open in Traces".')
                  : '',
            }
          ),
        },
      ],
    },
  ];
}

function getDemoModeGuides(): GuidesContent {
  return [
    {
      guide: 'sidebar_v2',
      requiredTargets: ['projects'],
      priority: 1,
      markOthersAsSeen: true,
      steps: [
        {
          title: t('Projects'),
          target: 'projects',
          description: t(
            `Create a project for any type of application you want to monitor.`
          ),
        },
        {
          title: t('Issues'),
          target: 'issues',
          description: t(
            `Here's a list of what's broken and slow. Sentry automatically groups similar events together into an issue.`
          ),
        },
        {
          title: t('Performance'),
          target: 'performance',
          description: t(
            `Keep a pulse on crash rates, throughput, and latency issues across projects.`
          ),
        },
        {
          title: t('Releases'),
          target: 'releases',
          description: t(
            `Track the health of every release, see differences between releases from crash analytics to adoption rates.`
          ),
        },
        {
          title: t('Discover'),
          target: 'discover',
          description: t(
            `Query and unlock insights into the health of your entire system and get answers to critical business questions all in one place.`
          ),
          nextText: t('Got it'),
        },
      ],
    },
    {
      guide: 'issue_stream_v3',
      requiredTargets: ['issue_stream'],
      steps: [
        {
          title: t('Issues'),
          target: 'issue_stream',
          description: t(
            `Sentry automatically groups similar events together into an issue. Similarity is
            determined by stack trace and other factors. Click on an issue to learn more.`
          ),
        },
      ],
    },
    {
      guide: 'issues_v3',
      requiredTargets: ['tags'],
      steps: [
        {
          title: t('Metadata and metrics'),
          target: 'tags',
          description: t(
            `See tags like specific users affected by the event, device, OS, and browser type.
            On the right side of the page you can view the number of affected users and exception frequency overtime.`
          ),
        },
        {
          title: t('Find your broken code'),
          target: 'stacktrace',
          description: t(
            `View the stack trace to see the exact sequence of function calls leading to the error in question.`
          ),
        },
        {
          title: t('Retrace your steps'),
          target: 'breadcrumbs',
          description: t(
            `Sentry automatically captures breadcrumbs for events so you can see the sequence of events leading up to the error.`
          ),
          nextText: t('Got it'),
        },
      ],
    },
    {
      guide: 'releases_v2',
      requiredTargets: ['release_projects'],
      priority: 1,
      steps: [
        {
          title: t('Compare releases'),
          target: 'release_projects',
          description: t(
            `Click here and select the "react-native" project to see how the release is trending compared to previous releases.`
          ),
        },
      ],
    },
    {
      guide: 'react-native-release',
      requiredTargets: ['release_version'],
      steps: [
        {
          title: t('Release-specific trends'),
          target: 'release_version',
          description: t(
            `Select the latest release to review new and regressed issues, and business critical metrics like crash rate, and user adoption.`
          ),
        },
      ],
    },
    {
      guide: 'release-details_v2',
      requiredTargets: ['release_states'],
      steps: [
        {
          title: t('New and regressed issues'),
          target: 'release_states',
          description: t(
            `Along with reviewing how your release is trending over time compared to previous releases, you can view new and regressed issues here.`
          ),
        },
      ],
    },
    {
      guide: 'performance',
      requiredTargets: ['performance_table'],
      steps: [
        {
          title: t('See slow transactions'),
          target: 'performance_table',
          description: t(
            `Trace slow-loading pages back to their API calls, as well as, related errors and users impacted across projects. Select a transaction to see more details.`
          ),
        },
      ],
    },
    {
      guide: 'transaction_summary',
      requiredTargets: ['user_misery', 'transactions_table'],
      steps: [
        {
          title: t('Identify the root cause'),
          target: 'user_misery',
          description: t(
            'Dive into the details behind a slow transaction. See User Misery, Apdex, and more metrics, along with related events and suspect spans.'
          ),
        },
        {
          title: t('Breakdown event spans'),
          target: 'transactions_table',
          description: t(
            'Select an Event ID from a list of slow transactions to uncover slow spans.'
          ),
          nextText: t('Got it'),
        },
      ],
    },
    {
      guide: 'transaction_details_v2',
      requiredTargets: ['span_tree'],
      steps: [
        {
          title: t('See slow fast'),
          target: 'span_tree',
          description: t(
            `Expand the spans to see span details from start date, end date to the operation. Below you can view breadcrumbs for a play-by-play of what your users
            did before encountering the performance issue.`
          ),
        },
      ],
    },
  ];
}
