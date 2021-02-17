import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import SuggestProjectCTA from 'app/components/suggestProjectCTA';

describe('SuggestProjectCTA', function () {
  it('shows prompt', async () => {
    MockApiClient.addMockResponse({
      url: `/prompts-activity/`,
      body: {},
    });
    const projects = [TestStubs.Project({platform: 'javascript'})];

    const props = {
      organization: TestStubs.Organization(),
      projects,
      event: TestStubs.Event({
        entries: [{type: 'request', data: {headers: [['User-Agent', 'okhttp/123']]}}],
      }),
    };
    const wrapper = mountWithTheme(<SuggestProjectCTA {...props} />);
    await tick();
    wrapper.update();
    expect(wrapper.find('Alert')).toHaveLength(1);
  });
});
