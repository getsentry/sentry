export function ProjectAlertRuleConfiguration(params = {}) {
  return {
    conditions: [
      {
        enabled: true,
        id: 'sentry.rules.conditions.every_event.EveryEventCondition',
        label: 'An event occurs',
      },
      {
        enabled: true,
        id: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition',
        label: 'The issue is first seen',
      },
      {
        enabled: true,
        id: 'sentry.rules.conditions.regression_event.RegressionEventCondition',
        label: 'The issue changes state from resolved to unresolved',
      },
      {
        enabled: true,
        id: 'sentry.rules.conditions.reappeared_event.ReappearedEventCondition',
        label: 'The issue changes state from ignored to unresolved',
      },
      {
        formFields: {
          value: {placeholder: 'value', type: 'string'},
          match: {
            type: 'choice',
            choices: [
              ['eq', 'equals'],
              ['ne', 'does not equal'],
              ['sw', 'starts with'],
              ['ew', 'ends with'],
              ['co', 'contains'],
              ['nc', 'does not contain'],
              ['is', 'is set'],
              ['ns', 'is not set'],
            ],
          },
          key: {placeholder: 'key', type: 'string'},
        },
        enabled: true,
        id: 'sentry.rules.conditions.tagged_event.TaggedEventCondition',
        label: "An event's tags match {key} {match} {value}",
      },
      {
        formFields: {
          interval: {
            type: 'choice',
            choices: [
              ['1m', 'one minute'],
              ['1h', 'one hour'],
              ['1d', 'one day'],
              ['1w', 'one week'],
              ['30d', '30 days'],
            ],
          },
          value: {placeholder: 100, type: 'number'},
        },
        enabled: true,
        id: 'sentry.rules.conditions.event_frequency.EventFrequencyCondition',
        label: 'The issue is seen more than {value} times in {interval}',
      },
      {
        formFields: {
          interval: {
            type: 'choice',
            choices: [
              ['1m', 'one minute'],
              ['1h', 'one hour'],
              ['1d', 'one day'],
              ['1w', 'one week'],
              ['30d', '30 days'],
            ],
          },
          value: {placeholder: 100, type: 'number'},
        },
        enabled: true,
        id: 'sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition',
        label: 'The issue is seen by more than {value} users in {interval}',
      },
      {
        formFields: {
          attribute: {
            placeholder: 'i.e. exception.type',
            type: 'choice',
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
              ['stacktrace.code', 'stacktrace.code'],
              ['stacktrace.module', 'stacktrace.module'],
              ['stacktrace.filename', 'stacktrace.filename'],
            ],
          },
          value: {placeholder: 'value', type: 'string'},
          match: {
            type: 'choice',
            choices: [
              ['eq', 'equals'],
              ['ne', 'does not equal'],
              ['sw', 'starts with'],
              ['ew', 'ends with'],
              ['co', 'contains'],
              ['nc', 'does not contain'],
              ['is', 'is set'],
              ['ns', 'is not set'],
            ],
          },
        },
        enabled: true,
        id: 'sentry.rules.conditions.event_attribute.EventAttributeCondition',
        label: "An event's {attribute} value {match} {value}",
      },
      {
        formFields: {
          match: {
            type: 'choice',
            choices: [
              ['eq', 'equal to'],
              ['lte', 'less than or equal to'],
              ['gte', 'greater than or equal to'],
            ],
          },
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
        },
        enabled: true,
        id: 'sentry.rules.conditions.level.LevelCondition',
        label: "An event's level is {match} {level}",
      },
    ],
    actions: [
      {
        enabled: true,
        id: 'sentry.rules.actions.notify_event.NotifyEventAction',
        label: 'Send a notification (for all legacy integrations)',
      },
      {
        formFields: {service: {type: 'choice', choices: [['mail', 'Mail']]}},
        enabled: true,
        id: 'sentry.rules.actions.notify_event_service.NotifyEventServiceAction',
        label: 'Send a notification via {service}',
      },
      {
        formFields: {
          channel: {placeholder: 'i.e #critical', type: 'string'},
          workspace: {type: 'choice', choices: []},
          tags: {placeholder: 'i.e environment,user,my_tag', type: 'string'},
        },
        enabled: false,
        id: 'sentry.integrations.slack.notify_action.SlackNotifyServiceAction',
        label:
          'Send a notification to the {workspace} Slack workspace to {channel} and show tags {tags} in notification',
      },
      {
        formFields: {
          account: {type: 'choice', choices: []},
          service: {type: 'choice', choices: []},
        },
        enabled: false,
        id: 'sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction',
        label: 'Send a notification to PagerDuty account {account} and service {service}',
      },
    ],
    filters: [
      {
        formFields: {
          comparison_type: {
            type: 'choice',
            choices: [
              ['older', 'older'],
              ['newer', 'newer'],
            ],
          },
          value: {
            placeholder: 10,
            type: 'number',
          },
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
        enabled: true,
        id: 'sentry.rules.filters.age_comparison.AgeComparisonFilter',
        label: 'An issue is {comparison_type} than {value} {time}',
      },
      {
        formFields: {
          value: {
            placeholder: 10,
            type: 'number',
          },
        },
        enabled: true,
        id: 'sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter',
        label: 'An issue has happened at least {value} times',
      },
    ],
    ...params,
  };
}
