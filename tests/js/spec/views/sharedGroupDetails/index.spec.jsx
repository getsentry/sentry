import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import SharedGroupDetails from 'app/views/sharedGroupDetails/sharedGroupDetails';

describe('SharedGroupDetails', function() {
  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/shared/issues/a/',
      body: TestStubs.Group({
        title: 'ZeroDivisionError',
        latestEvent: TestStubs.Event({
          entries: [TestStubs.EventEntry()],
        }),
        project: TestStubs.Project({organization: {slug: 'test-org'}}),
      }),
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('renders', function() {
    const props = {
      params: {shareId: 'a'},
    };

    const wrapper = mountWithTheme(
      <SharedGroupDetails {...props} />,
      TestStubs.routerContext()
    );
    expect(wrapper).toSnapshot();
    expect(wrapper).toMatchSnapshot();
  });
});
