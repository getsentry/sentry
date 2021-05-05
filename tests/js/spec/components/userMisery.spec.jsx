import {mountWithTheme} from 'sentry-test/enzyme';

import ScoreBar from 'app/components/scoreBar';
import UserMisery from 'app/components/userMisery';

describe('UserMisery', function () {
  beforeEach(function () {});

  afterEach(function () {});

  it('renders no bars when user misery is less than 0.05', function () {
    const wrapper = mountWithTheme(
      <UserMisery
        bars={10}
        barHeight={20}
        userMisery={0.04}
        miseryLimit={300}
        miserableUsers={0}
        totalUsers={100}
      />
    );
    expect(wrapper.find(ScoreBar).props().score).toEqual(0);
  });

  it('renders no bars when user misery is equal to 0.05', function () {
    const wrapper = mountWithTheme(
      <UserMisery
        bars={10}
        barHeight={20}
        userMisery={0.05}
        miseryLimit={300}
        miserableUsers={1}
        totalUsers={100}
      />
    );
    expect(wrapper.find(ScoreBar).props().score).toEqual(0);
  });

  it('renders one bar when user misery is greater than 0.05', function () {
    const wrapper = mountWithTheme(
      <UserMisery
        bars={10}
        barHeight={20}
        userMisery={0.06}
        miseryLimit={300}
        miserableUsers={1}
        totalUsers={100}
      />
    );
    expect(wrapper.find(ScoreBar).props().score).toEqual(1);
  });
});
