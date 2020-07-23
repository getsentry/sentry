import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import EventOrGroupTitle from 'app/components/eventOrGroupTitle';

describe('EventOrGroupTitle', function() {
  const data = {
    metadata: {
      title: 'metadata title',
      type: 'metadata type',
      directive: 'metadata directive',
      uri: 'metadata uri',
    },
    culprit: 'culprit',
  };

  it('renders with subtitle when `type = error`', function() {
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
    expect(component).toMatchSnapshot();
  });

  it('renders with subtitle when `type = csp`', function() {
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
    expect(component).toMatchSnapshot();
  });

  it('renders with no subtitle when `type = default`', function() {
    const component = mountWithTheme(
      <EventOrGroupTitle
        data={{
          ...data,
          ...{
            type: 'default',
          },
        }}
      />
    );

    expect(component).toSnapshot();
    expect(component).toMatchSnapshot();
  });
});
