import {render, screen} from 'sentry-test/reactTestingLibrary';

import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';

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
    const wrapper = render(
      <EventOrGroupTitle
        data={{
          ...data,
          ...{
            type: 'error',
          },
        }}
      />
    );

    expect(wrapper.container).toSnapshot();
  });

  it('renders with subtitle when `type = csp`', function () {
    const wrapper = render(
      <EventOrGroupTitle
        data={{
          ...data,
          ...{
            type: 'csp',
          },
        }}
      />
    );

    expect(wrapper.container).toSnapshot();
  });

  it('renders with no subtitle when `type = default`', function () {
    const wrapper = render(
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

    expect(wrapper.container).toSnapshot();
  });

  it('renders with title override', function () {
    const routerContext = TestStubs.routerContext([
      {organization: TestStubs.Organization({features: ['custom-event-title']})},
    ]);

    render(
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
      {context: routerContext}
    );

    expect(screen.getByText('metadata title')).toBeInTheDocument();
  });
});
