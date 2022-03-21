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
      requiredTargets: ['issue_title', 'exception'],
      steps: [
        {
          title: t("Let's Get This Over With"),
          target: 'issue_title',
          description: t(
            `No one likes a product tour. But stick with us, and you'll find it a
              whole lot easier to use Sentry's Issue details page.`
          ),
        },
        {
          title: t('Resolve Your Issues'),
          target: 'resolve',
          description: t(
            'So you fixed your problem? Congrats. Hit resolve to make it all go away.'
          ),
        },
        {
          title: t('Deal With It Later, Or Never'),
          target: 'ignore_delete_discard',
          description: t(
            `Just can't deal with this Issue right now? Ignore it. Saving it for later?
                Star it. Want it gone and out of your life forever?
                Delete that sh*t.`
          ),
        },
        {
          title: t('Identify Your Issues'),
          target: 'issue_number',
          description: tct(
            `You've got a lot of Issues. That's fine. Use the Issue number in your commit message,
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
          title: t('Find Information You Can Use'),
          target: 'tags',
          description: t(
            `So many bugs, so little time. When you've got bugs as far as the mouse can scroll,
                search and filter Events with tags or visualize Issues with a heat map.`
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
          nextText: t(`Allow`),
          hasNextGuide: true,
        },
      ],
    },
    {
      guide: 'stack_trace_preview',
      requiredTargets: ['issue_stream_title'],
      dateThreshold: new Date(2021, 2, 15),
      steps: [
        {
          title: t('Stack Trace Preview'),
          target: 'issue_stream_title',
          description: t(
            `Hover over the issue title to see the stack trace of the latest event.`
          ),
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
          title: t('Transactions'),
          target: 'trace_view_guide_row',
          description: t(
            `Get an overview of every transaction. You can quickly see all the transactions in a trace alongside the project, transaction duration, and any related errors.`
          ),
        },
        {
          title: t('Transactions Details'),
          target: 'trace_view_guide_row_details',
          description: t(`Click on any transaction to see more details.`),
        },
      ],
    },
    {
      guide: 'span_op_breakdowns_and_tag_explorer',
      requiredTargets: ['span_op_breakdowns_filter', 'span_op_relative_breakdowns'],
      steps: [
        {
          title: t('Filter by Span Operation'),
          target: 'span_op_breakdowns_filter',
          description: t(
            'You can now filter these transaction events based on http, db, browser or resource operation.'
          ),
        },
        {
          title: t('Span Operation Breakdown'),
          target: 'span_op_relative_breakdowns',
          description: tct(
            'By default, you can now see how each transaction is broken down by operation. Click the spans to filter. [link:Learn more]',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/performance/event-detail/#operations-breakdown" />
              ),
            }
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
      guide: 'team_key_transactions',
      requiredTargets: ['team_key_transaction_header'],
      steps: [
        {
          title: t('Key Transactions'),
          target: 'team_key_transaction_header',
          description: t(
            'Software development is a team sport. Key Transactions allow you to mark important transactions and share them with your team.'
          ),
          nextText: t('Great'),
        },
        {
          title: t('Migrating Key Transactions'),
          target: 'team_key_transaction_existing',
          description: t(
            'To migrate your previous key transactions, you will have to mark them as a key transaction again for your team. Sorry about that.'
          ),
          nextText: t('Fine'),
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
      guide: 'percentage_based_alerts',
      requiredTargets: ['percentage_based_alerts'],
      steps: [
        {
          title: t('Percentage Based Alerts'),
          target: 'percentage_based_alerts',
          description: tct(
            'View the event count as a percentage of sessions and alert on this number to adapt to changes in traffic patterns. [link:View the docs] to learn more.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/alerts/create-alerts/issue-alert-config/#when-conditions-triggers" />
              ),
            }
          ),
          nextText: t('Got it'),
        },
      ],
    },
    {
      guide: 'semver',
      requiredTargets: ['releases_search'],
      dateThreshold: new Date(2021, 6, 1),
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
      guide: 'release_stages',
      requiredTargets: ['release_stages'],
      dateThreshold: new Date(2021, 6, 1),
      steps: [
        {
          title: t('Adoption Filter'),
          target: 'release_stages',
          description: tct(
            'Select an environment and search for `release.stage:adopted` to filter out releases with low adoption. [br] [link:Learn more]',
            {
              br: <br />,
              link: (
                <ExternalLink href="https://docs.sentry.io/product/releases/usage/sorting-filtering/#filtering-releases" />
              ),
            }
          ),
          nextText: t('Got it'),
        },
      ],
    },
  ];
}

function getDemoModeGuides(): GuidesContent {
  return [
    {
      guide: 'sidebar',
      requiredTargets: ['projects', 'issues'],
      priority: 1, // lower number means higher priority
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
            `Here's a list of what's broken with your application. And everything you need to know to fix it.`
          ),
        },
        {
          title: t('Performance'),
          target: 'performance',
          description: t(
            `See slow faster. Trace slow-loading pages back to their API calls as well as surface all related errors.`
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
          nextText: t(`Got it`),
        },
      ],
    },
    {
      guide: 'issue_stream_v2',
      requiredTargets: ['issue_stream_title'],
      steps: [
        {
          title: t('Issue'),
          target: 'issue_stream_title',
          description: t(
            `Click here to get a full error report down to the line of code that caused the error.`
          ),
        },
      ],
    },
    {
      guide: 'issue_v2',
      requiredTargets: ['issue_details', 'exception'],
      steps: [
        {
          title: t('Details'),
          target: 'issue_details',
          description: t(`See the who, what, and where of every error right at the top`),
        },
        {
          title: t('Exception'),
          target: 'exception',
          description: t(
            `Source code right in the stack trace, so you don’t need to find it yourself.`
          ),
        },
        {
          title: t('Tags'),
          target: 'tags',
          description: t(
            `Tags help you quickly access related events and view the tag distribution for a set of events.`
          ),
        },
        {
          title: t('Breadcrumbs'),
          target: 'breadcrumbs',
          description: t(
            `Check out the play by play of what your user experienced till they encountered the exception.`
          ),
        },
        {
          title: t('Discover'),
          target: 'open_in_discover',
          description: t(
            `Uncover trends with Discover — analyze errors by URL, geography, device, browser, etc.`
          ),
        },
      ],
    },
    {
      guide: 'releases',
      requiredTargets: ['release_version'],
      steps: [
        {
          title: t('Release'),
          target: 'release_version',
          description: t(
            `Click here to easily identify new issues, regressions, and track the health of every release.`
          ),
        },
      ],
    },
    {
      guide: 'release_details',
      requiredTargets: ['release_chart'],
      steps: [
        {
          title: t('Chart'),
          target: 'release_chart',
          description: t(`Click and drag to zoom in on a specific section of the chart.`),
        },
        {
          title: t('Discover'),
          target: 'release_issues_open_in_discover',
          description: t(`Analyze these errors by URL, geography, device, browser, etc.`),
        },
        {
          title: t('Discover'),
          target: 'release_transactions_open_in_discover',
          description: t(
            `Analyze these performance issues by URL, geography, device, browser, etc.`
          ),
        },
      ],
    },
    {
      guide: 'discover_landing',
      requiredTargets: ['discover_landing_header'],
      steps: [
        {
          title: t('Discover'),
          target: 'discover_landing_header',
          description: t(
            `Click into any of the queries below to identify trends in event data.`
          ),
        },
      ],
    },
    {
      guide: 'discover_event_view',
      requiredTargets: ['create_alert_from_discover'],
      steps: [
        {
          title: t('Create Alert'),
          target: 'create_alert_from_discover',
          description: t(
            `Create an alert based on this query to get notified when an event exceeds user-defined thresholds.`
          ),
        },
        {
          title: t('Columns'),
          target: 'columns_header_button',
          description: t(
            `There's a whole lot more to... _discover_. View all the query conditions.`
          ),
        },
      ],
    },
    {
      guide: 'transaction_details',
      requiredTargets: ['span_tree'],
      steps: [
        {
          title: t('Span Tree'),
          target: 'span_tree',
          description: t(
            `Expand the spans to see span details from start date, end date to the operation.`
          ),
        },
        {
          title: t('Breadcrumbs'),
          target: 'breadcrumbs',
          description: t(
            `Check out the play by play of what your user experienced till they encountered the performance issue.`
          ),
        },
      ],
    },
  ];
}
