import React from 'react';
import {mount, shallow} from 'enzyme';
import IssueDiff from 'app/components/issueDiff';
import {Client} from 'app/api';
import entries from '../../mocks/entries';

jest.mock('app/api');

describe('IssueDiff', function() {
  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  it('is loading when initially rendering', function() {
    let wrapper = shallow(<IssueDiff baseIssueId="base" targetIssueId="target" />);
    expect(wrapper.find('SplitDiff')).toHaveLength(0);
    expect(wrapper).toMatchSnapshot();
  });

  it('can dynamically import SplitDiff', function(done) {
    Client.addMockResponse({
      url: '/issues/target/events/latest/',
      body: {
        entries: entries[0]
      }
    });
    Client.addMockResponse({
      url: '/issues/base/events/latest/',
      body: {
        platform: 'javascript',
        entries: entries[1]
      }
    });

    // Need `mount` because of componentDidMount in <IssueDiff>
    let wrapper = mount(<IssueDiff baseIssueId="base" targetIssueId="target" />);

    wrapper.instance().componentDidUpdate = jest.fn(() => {
      expect(wrapper.state('loading')).toBe(false);
      expect(wrapper.find('SplitDiff')).toHaveLength(1);
      expect(wrapper).toMatchSnapshot();
      done();
    });
  });
});
