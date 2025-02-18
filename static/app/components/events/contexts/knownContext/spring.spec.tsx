import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';
import {
  getSpringContextData,
  type SpringContext,
} from 'sentry/components/events/contexts/knownContext/spring';

const MOCK_SPRING_CONTEXT: SpringContext = {
  active_profiles: ['some', 'profiles'],
  // Extra data is still valid and preserved
  extra_data: 'something',
  unknown_key: 123,
};

describe('SpringContext', function () {
  it('returns values and according to the parameters', function () {
    expect(getSpringContextData({data: MOCK_SPRING_CONTEXT})).toEqual([
      {key: 'active_profiles', subject: 'Active Profiles', value: ['some', 'profiles']},
      {
        key: 'extra_data',
        subject: 'extra_data',
        value: 'something',
      },
      {
        key: 'unknown_key',
        subject: 'unknown_key',
        value: 123,
      },
    ]);
  });

  it('renders correctly', function () {
    const event = EventFixture();

    render(
      <ContextCard
        event={event}
        type={'spring'}
        alias={'spring'}
        value={{...MOCK_SPRING_CONTEXT}}
      />
    );

    expect(screen.getByText('Spring Context')).toBeInTheDocument();
    expect(screen.getByText('Active Profiles')).toBeInTheDocument();
  });
});
