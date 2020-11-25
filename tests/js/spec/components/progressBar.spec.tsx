import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ProgressBar from 'app/components/progressBar';

describe('Tag', function () {
  const progressBarValue = 50;

  it('basic', function () {
    const wrapper = mountWithTheme(<ProgressBar value={progressBarValue} />);
    expect(wrapper.find('Tooltip').length).toEqual(0);
  });

  it('with tooltip', function () {
    const tooltipText = 'lorem ipsum';
    const wrapper = mountWithTheme(
      <ProgressBar value={progressBarValue} tooltipText={tooltipText} />
    );

    const tooltipElement = wrapper.find('Tooltip');
    expect(tooltipElement.length).toEqual(1);
    expect(tooltipElement.prop('title')).toEqual(tooltipText);
  });
});
