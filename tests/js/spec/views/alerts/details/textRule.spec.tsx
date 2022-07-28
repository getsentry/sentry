import {render} from 'sentry-test/reactTestingLibrary';

import {TextCondition} from 'sentry/views/alerts/rules/issue/details/textRule';

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
          comparisonInterval: '1h',
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
      'Number of events in an issue is 150% higher in 1h compared to 1h ago'
    );
  });
});
