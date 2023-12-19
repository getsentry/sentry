import {GuidesContent} from 'sentry/components/assistant/types';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';

export default function getGuidesContent(orgSlug: string | null): GuidesContent {
  if (ConfigStore.get('demoMode')) {
    return getDemoModeGuides();
  }
  return [
    {
      guide: 'issue',
      requiredTargets: ['issue_number', 'exception'],
      steps: [
        {
          title: t('Identify Your Issues'),
          target: 'issue_number',
          description: tct(
            `You have Issues. That's fine. Use the Issue number in your commit message,
                and we'll automatically resolve the Issue when your code is deployed. [link:Learn more]`,
            {link: <ExternalLink href="https://docs.sentry.io/product/releases/" />}
          ),
        },
        {
          title: t('Annoy the Right People'),
          target: 'owners',
          description: tct(
            `Notification overload makes it tempting to hurl your phone into the ocean.
                Define who is responsible for what, so alerts reach the right people and your
                devices stay on dry land. [link:Learn more]`,
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/error-monitoring/issue-owners/" />
              ),
            }
          ),
        },
        {
          title: t('Narrow Down Suspects'),
          target: 'exception',
          description: t(
            `We've got stack trace. See the exact sequence of function calls leading to the error
                in question, no detective skills necessary.`
          ),
        },
        {
          title: t('Retrace Your Steps'),
          target: 'breadcrumbs',
          description: t(
            `Not sure how you got here? Sentry automatically captures breadcrumbs for events in web
                frameworks to lead you straight to your error.`
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
              link: <Link to={orgSlug ? `/settings/${orgSlug}` : `/settings`} />,
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
      guide: 'semver',
      requiredTargets: ['releases_search'],
      dateThreshold: new Date('2021-05-01'),
      steps: [
        {
          title: t('Filter by Semver'),
          target: 'releases_search',
          description: tct(
            'You can now filter releases by semver. For example: release.version:>14.0 [br] [link:View the docs]',
            {
              br: <br />,
              link: (
                <ExternalLink href="https://docs.sentry.io/product/releases/usage/sorting-filtering/#filtering-releases" />
              ),
            }
          ),
          nextText: t('Leave me alone'),
        },
      ],
    },
    {
      guide: 'releases_widget',
      requiredTargets: ['releases_widget'],
      dateThreshold: new Date('2022-06-22'),
      steps: [
        {
          title: t('Releases are here'),
          target: 'releases_widget',
          description: t(
            'Want to know how your latest release is doing? Monitor release health and crash rates in Dashboards.'
          ),
          nextText: t('Sounds good'),
        },
      ],
    },
    {
      guide: 'activate_sampling_rule',
      requiredTargets: ['sampling_rule_toggle'],
      dateThreshold: new Date('2022-07-05'),
      steps: [
        {
          title: t('Activate your first rule'),
          target: 'sampling_rule_toggle',
          description: t(
            'Activating a rule will take immediate effect, as well as any changes given to an active rule.'
          ),
          nextText: t('Activate Rule'),
          dismissText: t('Later'),
          hasNextGuide: true,
        },
      ],
    },
    {
      guide: 'create_conditional_rule',
      requiredTargets: ['add_conditional_rule'],
      dateThreshold: new Date('2022-07-05'),
      steps: [
        {
          title: t('Create a new sample rule'),
          target: 'add_conditional_rule',
          description: t(
            'Sample transactions under specific conditions, keeping what you need and dropping what you don’t.'
          ),
          dismissText: t('Enough already'),
        },
      ],
    },
    {
      guide: 'explain_archive_button_issue_details',
      requiredTargets: ['issue_details_archive_button'],
      dateThreshold: new Date('2023-07-05'),
      steps: [
        {
          title: t('Ignore is Now Archive'),
          target: 'issue_details_archive_button',
          description: t(
            "Archive this issue to move it out of the stream - but don't worry, we'll bring it back if it escalates."
          ),
          dismissText: t('Go Away'),
        },
      ],
    },
    {
      guide: 'explain_archive_button_issue_stream',
      requiredTargets: ['issue_stream_archive_button'],
      dateThreshold: new Date('2023-10-02'),
      steps: [
        {
          title: t('"Archive" is the new "Ignore"'),
          target: 'issue_stream_archive_button',
          description: t(
            "Archive this issue to move it out of the stream - but don't worry, we'll bring it back if it escalates."
          ),
          dismissText: t('Got It'),
        },
      ],
    },
    {
      guide: 'explain_new_default_event_issue_detail',
      requiredTargets: ['issue_details_default_event'],
      dateThreshold: new Date('2023-08-22'),
      steps: [
        {
          title: t('New Default Event'),
          target: 'issue_details_default_event',
          description: tct(
            'Rather than the latest event, we now default to a recent event with the most context (replays, traces, and profiles). You can easily switch between events or [link:configure your default event] in settings.',
            {
              link: <Link to="/settings/account/details/#defaultIssueEvent" />,
            }
          ),
          dismissText: t('Got It'),
        },
      ],
    },
    {
      guide: 'explain_archive_tab_issue_stream',
      requiredTargets: ['issue_stream_archive_tab'],
      dateThreshold: new Date('2023-07-05'),
      steps: [
        {
          title: t('Nothing to see here'),
          target: 'issue_stream_archive_tab',
          description: t(
            "Archived issues will live here. We'll mark them as Escalating if we detect a large number of events."
          ),
          dismissText: t('Goodbye Forever'),
        },
      ],
    },
    {
      guide: 'ddm_view',
      requiredTargets: ['create_scratchpad'],
      steps: [
        {
          title: t('Save your charts'),
          target: 'create_scratchpad',
          description: t(
            `Scratchpads are stored locally on your device. If you want to share them, simply send the URL to your teammates.`
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
          target: 'stack_trace',
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
          title: t('Release-specfic trends'),
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
