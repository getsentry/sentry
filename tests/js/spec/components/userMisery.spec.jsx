import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ScoreBar from 'app/components/scoreBar';
import UserMisery from 'app/components/userMisery';

describe('UserMisery', function () {
  beforeEach(function () {});

  afterEach(function () {});

  it('renders no bars when miserable users is zero', function () {
    const wrapper = mountWithTheme(
      <UserMisery
        bars={10}
        barHeight={20}
        miseryLimit={300}
        miserableUsers={0}
        totalUsers={100}
      />
    );
    expect(wrapper.find(ScoreBar).props().score).toEqual(0);
  });

  it('renders one bar when miserable users are close to zero', function () {
    const wrapper = mountWithTheme(
      <UserMisery
        bars={10}
        barHeight={20}
        miseryLimit={300}
        miserableUsers={1}
        totalUsers={100}
      />
    );
    expect(wrapper.find(ScoreBar).props().score).toEqual(1);
  });
});
