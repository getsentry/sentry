import React from 'react';
import {shallow} from 'enzyme';
import ScoreBar from 'app/components/scoreBar';

describe('ScoreBar', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('renders', function() {
    let wrapper = shallow(<ScoreBar size={60} thickness={2} score={3} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders vertically', function() {
    let wrapper = shallow(<ScoreBar size={60} thickness={2} vertical score={2} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders with score = 0', function() {
    let wrapper = shallow(<ScoreBar size={60} thickness={2} score={0} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders with score > max score', function() {
    let wrapper = shallow(<ScoreBar size={60} thickness={2} score={10} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders with < 0 score', function() {
    let wrapper = shallow(<ScoreBar size={60} thickness={2} score={-2} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('has custom palette', function() {
    let wrapper = shallow(
      <ScoreBar
        vertical
        size={60}
        thickness={2}
        score={7}
        palette={['white', 'red', 'red', 'pink', 'pink', 'purple', 'purple', 'black']}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });
});
