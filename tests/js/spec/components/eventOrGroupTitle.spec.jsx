import React from 'react';
import {shallow} from 'sentry-test/enzyme';
import toJson from 'enzyme-to-json';
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
    const component = shallow(
      <EventOrGroupTitle
        data={{
          ...data,
          ...{
            type: 'error',
          },
        }}
      />
    );

    expect(toJson(component)).toMatchSnapshot();
  });

  it('renders with subtitle when `type = csp`', function() {
    const component = shallow(
      <EventOrGroupTitle
        data={{
          ...data,
          ...{
            type: 'csp',
          },
        }}
      />
    );

    expect(toJson(component)).toMatchSnapshot();
  });

  it('renders with no subtitle when `type = default`', function() {
    const component = shallow(
      <EventOrGroupTitle
        data={{
          ...data,
          ...{
            type: 'default',
          },
        }}
      />
    );

    expect(toJson(component)).toMatchSnapshot();
  });
});
