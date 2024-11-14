import {render} from 'sentry-test/reactTestingLibrary';

import {
  TextAction,
  TextCondition,
} from 'sentry/views/alerts/rules/issue/details/textRule';

describe('AlertRuleDetails', () => {
  it('displays EventFrequencyCondition percentage', () => {
    const wrapper = render(
      <TextCondition
        condition={{
          comparisonType: 'count',
          id: 'sentry.rules.conditions.event_frequency.EventFrequencyCondition',
          interval: '1h',
          name: 'The issue is seen more than 1000 times in 1h',
          value: 1000,

          // TODO(scttcper): label and prompt only exist in the type definition
          label: '',
          prompt: '',
        }}
      />
    );
    expect(wrapper.container).toHaveTextContent(
      'Number of events in an issue is more than 1000 in 1h'
    );
  });
  it('displays EventFrequencyCondition count', () => {
    const wrapper = render(
      <TextCondition
        condition={{
          comparisonInterval: '1w',
          comparisonType: 'percent',
          id: 'sentry.rules.conditions.event_frequency.EventFrequencyCondition',
          interval: '1h',
          name: 'The issue is seen more than 150 times in 1h',
          value: 150,

          // TODO(scttcper): label and prompt only exist in the type definition
          label: '',
          prompt: '',
        }}
      />
    );
    expect(wrapper.container).toHaveTextContent(
      'Number of events in an issue is 150% higher in 1h compared to 1w ago'
    );
  });

  it('displays EventFrequencyPercentCondition count', () => {
    const wrapper = render(
      <TextCondition
        condition={{
          comparisonInterval: '1d',
          comparisonType: 'percent',
          id: 'sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition',
          interval: '1h',
          name: 'Percent of sessions affected by an issue is 150% higher in 1h compared to 1w ago',
          value: 150,

          // TODO(scttcper): label and prompt only exist in the type definition
          label: '',
          prompt: '',
        }}
      />
    );
    expect(wrapper.container).toHaveTextContent(
      'Percent of sessions affected by an issue is 150% higher in 1h compared to 1d ago'
    );
  });

  it('displays EventUniqueUserFrequencyCondition count', () => {
    const wrapper = render(
      <TextCondition
        condition={{
          id: 'sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition',
          comparisonType: 'count',
          interval: '1d',
          name: 'The issue is seen by more than 89 users in 1d',
          value: 89,
        }}
      />
    );
    expect(wrapper.container).toHaveTextContent(
      'Number of users affected by an issue is more than 89 in 1d'
    );
  });

  it('hides slack id and empty tags', () => {
    const wrapper = render(
      <TextAction
        action={{
          id: 'sentry.integrations.slack.notify_action.SlackNotifyServiceAction',
          name: 'Send a notification to the Sentry Slack workspace to #my-channel (optionally, an ID: ) and show tags [] in notification',

          // TODO(scttcper): label and prompt only exist in the type definition
          label: '',
          prompt: '',
        }}
        memberList={[]}
        teams={[]}
      />
    );
    expect(wrapper.container).toHaveTextContent(
      'Send a notification to the Sentry Slack workspace to #my-channel'
    );
  });
  it('shows slack tags', () => {
    const wrapper = render(
      <TextAction
        action={{
          id: 'sentry.integrations.slack.notify_action.SlackNotifyServiceAction',
          name: 'Send a notification to the Sentry Slack workspace to #my-channel (optionally, an ID: ) and show tags [tag1, tag2] in notification',

          // TODO(scttcper): label and prompt only exist in the type definition
          label: '',
          prompt: '',
        }}
        memberList={[]}
        teams={[]}
      />
    );
    expect(wrapper.container).toHaveTextContent(
      'Send a notification to the Sentry Slack workspace to #my-channel and show tags [tag1, tag2] in notification'
    );
  });
});
