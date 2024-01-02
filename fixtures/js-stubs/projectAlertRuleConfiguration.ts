import type {IssueAlertConfiguration} from 'sentry/types/alerts';

export function ProjectAlertRuleConfiguration(
  params: Partial<IssueAlertConfiguration> = {}
): IssueAlertConfiguration {
  return {
    actions: [
      {
        id: 'sentry.mail.actions.NotifyEmailAction',
        label: 'Send a notification to {targetType}',
        enabled: true,
        prompt: 'Send a notification',
        formFields: {
          targetType: {
            type: 'choice',
            placeholder: 'mailAction',
            choices: [
              ['IssueOwners', 'Issue Owners'],
              ['Team', 'Team'],
              ['Member', 'Member'],
            ],
          },
        },
      },
      {
        id: 'sentry.rules.actions.notify_event.NotifyEventAction',
        label: 'Send a notification (for all legacy integrations)',
        enabled: true,
        prompt: 'Send a notification to all legacy integrations',
      },
      {
        id: 'sentry.integrations.slack.notify_action.SlackNotifyServiceAction',
        label:
          'Send a notification to the {workspace} Slack workspace to {channel} (optionally, an ID: {channel_id}) and show tags {tags} in notification',
        enabled: true,
        prompt: 'Send a Slack notification',
        formFields: {
          workspace: {type: 'choice', choices: [['123', 'Sentry']]},
          channel: {type: 'string', placeholder: 'i.e #critical, Jane Schmidt'},
          channel_id: {type: 'string', placeholder: 'i.e. CA2FRA079 or UA1J9RTE1'},
          tags: {type: 'string', placeholder: 'i.e environment,user,my_tag'},
        },
      },
      {
        id: 'sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction',
        label: 'Send a notification to PagerDuty account {account} and service {service}',
        enabled: true,
        prompt: 'Send a PagerDuty notification',
        formFields: {
          account: {type: 'choice', choices: []},
          service: {type: 'choice', choices: []},
        },
      },
    ],
    conditions: [
      {
        id: 'sentry.rules.conditions.every_event.EveryEventCondition',
        label: 'The event occurs',
        enabled: false,
      },
      {
        id: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition',
        label: 'A new issue is created',
        enabled: true,
      },
      {
        id: 'sentry.rules.conditions.regression_event.RegressionEventCondition',
        label: 'The issue changes state from resolved to unresolved',
        enabled: true,
      },
      {
        id: 'sentry.rules.conditions.reappeared_event.ReappearedEventCondition',
        label: 'The issue changes state from ignored to unresolved',
        enabled: true,
      },
      {
        id: 'sentry.rules.conditions.event_frequency.EventFrequencyCondition',
        label: 'The issue is seen more than {value} times in {interval}',
        enabled: true,
        formFields: {
          value: {type: 'number', placeholder: 100},
          interval: {
            type: 'choice',
            choices: [
              ['1m', 'one minute'],
              ['5m', '5 minutes'],
              ['15m', '15 minutes'],
              ['1h', 'one hour'],
              ['1d', 'one day'],
              ['1w', 'one week'],
              ['30d', '30 days'],
            ],
          },
        },
      },
      {
        id: 'sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition',
        label: 'The issue is seen by more than {value} users in {interval}',
        enabled: true,
        formFields: {
          value: {type: 'number', placeholder: 100},
          interval: {
            type: 'choice',
            choices: [
              ['1m', 'one minute'],
              ['5m', '5 minutes'],
              ['15m', '15 minutes'],
              ['1h', 'one hour'],
              ['1d', 'one day'],
              ['1w', 'one week'],
              ['30d', '30 days'],
            ],
          },
        },
      },
      {
        id: 'sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition',
        label: 'The issue affects more than {value} percent of sessions in {interval}',
        enabled: true,
        formFields: {
          value: {type: 'number', placeholder: 100},
          interval: {
            type: 'choice',
            choices: [
              ['5m', '5 minutes'],
              ['10m', '10 minutes'],
              ['30m', '30 minutes'],
              ['1h', '1 hour'],
            ],
          },
        },
      },
    ],
    filters: [
      {
        id: 'sentry.rules.filters.age_comparison.AgeComparisonFilter',
        label: 'The issue is {comparison_type} than {value} {time}',
        enabled: true,
        prompt: 'The issue is older or newer than...',
        formFields: {
          comparison_type: {
            type: 'choice',
            choices: [
              ['older', 'older'],
              ['newer', 'newer'],
            ],
          },
          value: {type: 'number', placeholder: 10},
          time: {
            type: 'choice',
            choices: [
              ['minute', 'minute(s)'],
              ['hour', 'hour(s)'],
              ['day', 'day(s)'],
              ['week', 'week(s)'],
            ],
          },
        },
      },
      {
        id: 'sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter',
        label: 'The issue has happened at least {value} times',
        enabled: true,
        prompt: 'The issue has happened at least {x} times (Note: this is approximate)',
        formFields: {value: {type: 'number', placeholder: 10}},
      },
      {
        id: 'sentry.rules.filters.assigned_to.AssignedToFilter',
        label: 'The issue is assigned to {targetType}',
        enabled: true,
        prompt: 'The issue is assigned to {no one/team/member}',
        formFields: {
          targetType: {
            type: 'choice',
            placeholder: 'assignee',
            choices: [
              ['Unassigned', 'Unassigned'],
              ['Team', 'Team'],
              ['Member', 'Member'],
            ],
          },
        },
      },
      {
        id: 'sentry.rules.filters.latest_adopted_release_filter.LatestAdoptedReleaseFilter',
        label:
          "The {oldest_or_newest} release associated with the event's issue is {older_or_newer} than the latest release in {environment}",
        enabled: true,
        formFields: {
          oldest_or_newest: {
            type: 'choice',
            choices: [
              ['oldest', 'oldest'],
              ['newest', 'newest'],
            ],
          },
          older_or_newer: {
            type: 'choice',
            choices: [
              ['older', 'older'],
              ['newer', 'newer'],
            ],
          },
          environment: {
            type: 'string',
            placeholder: 'value',
          },
        },
      },
      {
        id: 'sentry.rules.filters.event_attribute.EventAttributeFilter',
        label: "The event's {attribute} value {match} {value}",
        enabled: true,
        formFields: {
          attribute: {
            type: 'choice',
            placeholder: 'i.e. exception.type',
            choices: [
              ['message', 'message'],
              ['platform', 'platform'],
              ['environment', 'environment'],
              ['type', 'type'],
              ['exception.type', 'exception.type'],
              ['exception.value', 'exception.value'],
              ['user.id', 'user.id'],
              ['user.email', 'user.email'],
              ['user.username', 'user.username'],
              ['user.ip_address', 'user.ip_address'],
              ['http.method', 'http.method'],
              ['http.url', 'http.url'],
              ['sdk.name', 'sdk.name'],
              ['stacktrace.code', 'stacktrace.code'],
              ['stacktrace.module', 'stacktrace.module'],
              ['stacktrace.filename', 'stacktrace.filename'],
              ['stacktrace.abs_path', 'stacktrace.abs_path'],
              ['stacktrace.package', 'stacktrace.package'],
            ],
          },
          match: {
            type: 'choice',
            choices: [
              ['co', 'contains'],
              ['ew', 'ends with'],
              ['eq', 'equals'],
              ['is', 'is set'],
              ['nc', 'does not contain'],
              ['new', 'does not end with'],
              ['ne', 'does not equal'],
              ['ns', 'is not set'],
              ['nsw', 'does not start with'],
              ['sw', 'starts with'],
            ],
          },
          value: {type: 'string', placeholder: 'value'},
        },
      },
      {
        id: 'sentry.rules.filters.tagged_event.TaggedEventFilter',
        label: "The event's tags match {key} {match} {value}",
        enabled: true,
        formFields: {
          key: {type: 'string', placeholder: 'key'},
          match: {
            type: 'choice',
            choices: [
              ['co', 'contains'],
              ['ew', 'ends with'],
              ['eq', 'equals'],
              ['is', 'is set'],
              ['nc', 'does not contain'],
              ['new', 'does not end with'],
              ['ne', 'does not equal'],
              ['ns', 'is not set'],
              ['nsw', 'does not start with'],
              ['sw', 'starts with'],
            ],
          },
          value: {type: 'string', placeholder: 'value'},
        },
      },
      {
        id: 'sentry.rules.filters.level.LevelFilter',
        label: "The event's level is {match} {level}",
        enabled: true,
        formFields: {
          level: {
            type: 'choice',
            choices: [
              ['50', 'fatal'],
              ['40', 'error'],
              ['30', 'warning'],
              ['20', 'info'],
              ['10', 'debug'],
              ['0', 'sample'],
            ],
          },
          match: {
            type: 'choice',
            choices: [
              ['eq', 'equal to'],
              ['gte', 'greater than or equal to'],
              ['lte', 'less than or equal to'],
            ],
          },
        },
      },
    ],
    ...params,
  };
}
