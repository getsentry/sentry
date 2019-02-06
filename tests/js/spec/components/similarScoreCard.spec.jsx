import React from 'react';
import {shallow} from 'enzyme';
import SimilarScoreCard from 'app/components/similarScoreCard';

describe('SimilarScoreCard', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('renders', function() {
    const wrapper = shallow(<SimilarScoreCard />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders with score list', function() {
    const wrapper = shallow(
      <SimilarScoreCard
        scoreList={[
          ['exception,message,character-shingles', null],
          ['exception,stacktrace,application-chunks', 0.8],
          ['exception,stacktrace,pairs', 1],
          ['message,message,character-shingles', 0.5],
        ]}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });
});
