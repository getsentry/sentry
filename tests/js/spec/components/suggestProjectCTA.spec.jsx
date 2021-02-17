import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {openModal} from 'app/actionCreators/modal';
import SuggestProjectCTA from 'app/components/suggestProjectCTA';
import ProjectsStore from 'app/stores/projectsStore';

jest.mock('app/actionCreators/modal');

function generateWrapper(inputProps) {
  const projects = inputProps?.projects ?? [TestStubs.Project({platform: 'javascript'})];

  jest.spyOn(ProjectsStore, 'getState').mockImplementation(() => ({
    projects,
    loading: false,
  }));

  const props = {
    organization: TestStubs.Organization(),
    event: TestStubs.Event({
      entries: [{type: 'request', data: {headers: [['User-Agent', 'okhttp/123']]}}],
    }),
    ...inputProps,
  };
  return mountWithTheme(<SuggestProjectCTA {...props} />);
}

describe('SuggestProjectCTA', function () {
  it('shows prompt and open modal', async () => {
    MockApiClient.addMockResponse({
      url: `/prompts-activity/`,
      body: {},
    });
    const wrapper = generateWrapper();
    await tick();
    wrapper.update();
    expect(wrapper.find('Alert')).toHaveLength(1);
    wrapper.find('a').simulate('click');
    expect(openModal).toHaveBeenCalled();
  });
  it('user agent does not match', async () => {
    MockApiClient.addMockResponse({
      url: `/prompts-activity/`,
      body: {},
    });
    const wrapper = generateWrapper({
      event: TestStubs.Event({
        entries: [{type: 'request', data: {headers: [['User-Agent', 'firefox/123']]}}],
      }),
    });
    await tick();
    wrapper.update();
    expect(wrapper.find('Alert')).toHaveLength(0);
  });
  it('has mobile project', async () => {
    MockApiClient.addMockResponse({
      url: `/prompts-activity/`,
      body: {},
    });
    const projects = [TestStubs.Project({platform: 'android'})];
    const wrapper = generateWrapper({
      projects,
    });
    await tick();
    wrapper.update();
    expect(wrapper.find('Alert')).toHaveLength(0);
  });
  it('prompt is dismissed', async () => {
    MockApiClient.addMockResponse({
      url: `/prompts-activity/`,
      body: {data: {dismissed_ts: 1234}},
    });
    const wrapper = generateWrapper();
    await tick();
    wrapper.update();
    expect(wrapper.find('Alert')).toHaveLength(0);
  });
});
