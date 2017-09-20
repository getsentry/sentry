import React from 'react';
import {shallow} from 'enzyme';
import SimilarScoreCard from 'app/components/similarScoreCard';

describe('SimilarScoreCard', function() {
  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  it('renders', function() {
    let wrapper = shallow(<SimilarScoreCard />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders with score list', function() {
    let wrapper = shallow(
      <SimilarScoreCard
        scoreList={[
          ['exception,message,character-shingles', null],
          ['exception,stacktrace,application-chunks', 0.8],
          ['exception,stacktrace,pairs', 1],
          ['message,message,character-shingles', 0.5]
        ]}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });
});
