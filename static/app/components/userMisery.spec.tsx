import {render, screen} from 'sentry-test/reactTestingLibrary';

import UserMisery from 'sentry/components/userMisery';

describe('UserMisery', function () {
  it('renders no bars when user misery is less than 0.05', function () {
    render(
      <UserMisery
        bars={10}
        barHeight={20}
        userMisery={0.04}
        miseryLimit={300}
        miserableUsers={0}
        totalUsers={100}
      />
    );

    expect(screen.getByTestId('score-bar-0')).toBeInTheDocument();
  });

  it('renders no bars when user misery is equal to 0.05', function () {
    render(
      <UserMisery
        bars={10}
        barHeight={20}
        userMisery={0.05}
        miseryLimit={300}
        miserableUsers={1}
        totalUsers={100}
      />
    );

    expect(screen.getByTestId('score-bar-0')).toBeInTheDocument();
  });

  it('renders one bar when user misery is greater than 0.05', function () {
    render(
      <UserMisery
        bars={10}
        barHeight={20}
        userMisery={0.06}
        miseryLimit={300}
        miserableUsers={1}
        totalUsers={100}
      />
    );

    expect(screen.getByTestId('score-bar-1')).toBeInTheDocument();
  });
});
