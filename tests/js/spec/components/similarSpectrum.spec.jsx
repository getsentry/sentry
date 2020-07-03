import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import SimilarSpectrum from 'app/components/similarSpectrum';

describe('SimilarSpectrum', function() {
  beforeEach(function() {});

  afterEach(function() {});

  it('renders', function() {
    const wrapper = shallow(<SimilarSpectrum />);
    expect(wrapper).toMatchSnapshot();
  });
});
