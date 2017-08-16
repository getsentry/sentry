import React from 'react';
import {shallow} from 'enzyme';
import ScoreBar from 'app/components/scoreBar';

describe('ScoreBar', function() {
  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  it('renders', function() {
    let wrapper = shallow(<ScoreBar score={3} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders vertically', function() {
    let wrapper = shallow(<ScoreBar vertical score={2} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('has custom palette', function() {
    let wrapper = shallow(
      <ScoreBar
        vertical
        score={7}
        palette={['white', 'red', 'red', 'pink', 'pink', 'purple', 'purple', 'black']}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });
});
