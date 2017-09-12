import React from 'react';
import {shallow} from 'enzyme';
import SimilarSpectrum from 'app/components/similarSpectrum';

describe('SimilarSpectrum', function() {
  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  it('renders', function() {
    let wrapper = shallow(<SimilarSpectrum />);
    expect(wrapper).toMatchSnapshot();
  });
});
