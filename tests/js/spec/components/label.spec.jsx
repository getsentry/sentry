import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import Label from 'app/components/label';

describe('Label', function() {
  it('renders', function() {
    const wrapper = mountWithTheme(
      <Label
        text="Unhandled"
        tooltip="An unhandled error was detected in this Issue."
        type="error"
      />
    );

    expect(wrapper.text()).toBe('Unhandled');
    expect(wrapper.find('Background').prop('color')).toBe('red100');
    expect(wrapper.find('Text').prop('color')).toBe('red300');
    expect(wrapper.find('Tooltip').prop('title')).toBe(
      'An unhandled error was detected in this Issue.'
    );
  });
});
