import {Fragment} from 'react';

import RangeSlider from 'sentry/components/forms/controls/rangeSlider';

export default {
  title: 'Components/Forms/Controls/Range Slider',
};

export const _RangeSlider = () => (
  <Fragment>
    <p>
      <h4>Without custom input</h4>
      <RangeSlider min={1} max={100} value={5} />
    </p>
    <p>
      <h4>With custom input</h4>
      <RangeSlider min={5} max={50} value={21} showCustomInput />
    </p>
  </Fragment>
);

_RangeSlider.storyName = 'Range Slider';
