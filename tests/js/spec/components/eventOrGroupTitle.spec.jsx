import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import EventOrGroupTitle from 'app/components/eventOrGroupTitle';

describe('EventOrGroupTitle', function () {
  const data = {
    metadata: {
      type: 'metadata type',
      directive: 'metadata directive',
      uri: 'metadata uri',
    },
    culprit: 'culprit',
  };

  it('renders with subtitle when `type = error`', function () {
    const component = mountWithTheme(
      <EventOrGroupTitle
        data={{
          ...data,
          ...{
            type: 'error',
          },
        }}
      />
    );

    expect(component).toSnapshot();
  });

  it('renders with subtitle when `type = csp`', function () {
    const component = mountWithTheme(
      <EventOrGroupTitle
        data={{
          ...data,
          ...{
            type: 'csp',
          },
        }}
      />
    );

    expect(component).toSnapshot();
  });

  it('renders with no subtitle when `type = default`', function () {
    const component = mountWithTheme(
      <EventOrGroupTitle
        data={{
          ...data,
          type: 'default',
          metadata: {
            ...data.metadata,
            title: 'metadata title',
          },
        }}
      />
    );

    expect(component).toSnapshot();
  });

  it('renders with title override', function () {
    const routerContext = TestStubs.routerContext([
      {organization: TestStubs.Organization({features: ['custom-event-title']})},
    ]);

    const component = mountWithTheme(
      <EventOrGroupTitle
        data={{
          ...data,
          type: 'error',
          metadata: {
            ...data.metadata,
            title: 'metadata title',
          },
        }}
      />,
      routerContext
    );

    expect(component.text()).toContain('metadata title');
  });
});
