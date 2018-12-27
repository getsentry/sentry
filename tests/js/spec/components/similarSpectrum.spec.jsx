import React from 'react';
import {shallow} from 'enzyme';
import SimilarSpectrum from 'app/components/similarSpectrum';

describe('SimilarSpectrum', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('renders', function() {
    let wrapper = shallow(<SimilarSpectrum />);
    expect(wrapper).toMatchSnapshot();
  });
});
