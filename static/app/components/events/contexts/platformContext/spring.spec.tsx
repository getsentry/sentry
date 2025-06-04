import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';
import {
  getSpringContextData,
  type SpringContext,
} from 'sentry/components/events/contexts/platformContext/spring';

const MOCK_SPRING_CONTEXT: SpringContext = {
  active_profiles: ['some', 'profiles'],
  // Extra data is still valid and preserved
  extra_data: 'something',
  unknown_key: 123,
};

describe('SpringContext', function () {
  it('returns values according to the parameters', function () {
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

    expect(screen.getByText('Spring')).toBeInTheDocument();
    expect(screen.getByText('Active Profiles')).toBeInTheDocument();
    expect(screen.getByText('extra_data')).toBeInTheDocument();
    expect(screen.getByText('something')).toBeInTheDocument();
    expect(screen.getByText('unknown_key')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
    expect(screen.getByTestId('spring-context-icon')).toBeInTheDocument();
  });
});
