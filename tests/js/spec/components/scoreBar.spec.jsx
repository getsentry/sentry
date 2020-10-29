import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ScoreBar from 'app/components/scoreBar';

describe('ScoreBar', function () {
  beforeEach(function () {});

  afterEach(function () {});

  it('renders', function () {
    const wrapper = mountWithTheme(<ScoreBar size={60} thickness={2} score={3} />);
    expect(wrapper).toSnapshot();
  });

  it('renders vertically', function () {
    const wrapper = mountWithTheme(
      <ScoreBar size={60} thickness={2} vertical score={2} />
    );
    expect(wrapper).toSnapshot();
  });

  it('renders with score = 0', function () {
    const wrapper = mountWithTheme(<ScoreBar size={60} thickness={2} score={0} />);
    expect(wrapper).toSnapshot();
  });

  it('renders with score > max score', function () {
    const wrapper = mountWithTheme(<ScoreBar size={60} thickness={2} score={10} />);
    expect(wrapper).toSnapshot();
  });

  it('renders with < 0 score', function () {
    const wrapper = mountWithTheme(<ScoreBar size={60} thickness={2} score={-2} />);
    expect(wrapper).toSnapshot();
  });

  it('has custom palette', function () {
    const wrapper = mountWithTheme(
      <ScoreBar
        vertical
        size={60}
        thickness={2}
        score={7}
        palette={['white', 'red', 'red', 'pink', 'pink', 'purple', 'purple', 'black']}
      />
    );
    expect(wrapper).toSnapshot();
  });
});
