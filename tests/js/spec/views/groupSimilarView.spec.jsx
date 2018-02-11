/* eslint-env jest */
import React from 'react';
import {mount, shallow} from 'enzyme';

import GroupSimilarView from 'app/views/groupSimilar/groupSimilarView';
import {Client} from 'app/api';
import issues from '../../mocks/issues';

jest.mock('app/api');
jest.mock('app/mixins/projectState', () => {
  return {
    getFeatures: () => new Set(['callsigns']),
    getProjectFeatures: () => new Set(['similarity-view']),
  };
});

const scores = [
  {'exception:stacktrace:pairs': 0.375},
  {'exception:stacktrace:pairs': 0.01264},
  {'exception:stacktrace:pairs': 0.875},
  {
    'exception:stacktrace:application-chunks': 0.000235,
    'exception:stacktrace:pairs': 0.001488,
  },
];

const mockData = {
  similar: issues.map((issue, i) => [issue, scores[i]]),
};

describe('Issues Similar View', function() {
  beforeAll(function() {
    Client.addMockResponse({
      url: '/issues/groupId/similar/?limit=50',
      body: mockData.similar,
    });
  });

  it('renders initially with loading component', function() {
    let component = shallow(
      <GroupSimilarView params={{groupId: 'groupId'}} location={{}} />
    );

    expect(component).toMatchSnapshot();
  });

  it('renders with mocked data', function(done) {
    let wrapper = mount(
      <GroupSimilarView
        params={{orgId: 'orgId', projectId: 'projectId', groupId: 'groupId'}}
        location={{}}
      />
    );

    setTimeout(() => {
      wrapper.update();
      expect(wrapper).toMatchSnapshot();
      done();
    }, 1);
  });
});
