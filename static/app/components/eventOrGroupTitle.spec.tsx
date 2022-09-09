import {render, screen} from 'sentry-test/reactTestingLibrary';

import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import {BaseGroup, EventOrGroupType, IssueCategory} from 'sentry/types';

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
        data={
          {
            ...data,
            ...{
              type: EventOrGroupType.ERROR,
            },
          } as BaseGroup
        }
      />
    );

    expect(wrapper.container).toSnapshot();
  });

  it('renders with subtitle when `type = csp`', function () {
    const wrapper = render(
      <EventOrGroupTitle
        data={
          {
            ...data,
            ...{
              type: EventOrGroupType.CSP,
            },
          } as BaseGroup
        }
      />
    );

    expect(wrapper.container).toSnapshot();
  });

  it('renders with no subtitle when `type = default`', function () {
    const wrapper = render(
      <EventOrGroupTitle
        data={
          {
            ...data,
            type: EventOrGroupType.DEFAULT,
            metadata: {
              ...data.metadata,
              title: 'metadata title',
            },
          } as BaseGroup
        }
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
        data={
          {
            ...data,
            type: EventOrGroupType.ERROR,
            metadata: {
              ...data.metadata,
              title: 'metadata title',
            },
          } as BaseGroup
        }
      />,
      {context: routerContext}
    );

    expect(screen.getByText('metadata title')).toBeInTheDocument();
  });

  it('does not render stack trace when issueCategory is performance', () => {
    render(
      <EventOrGroupTitle
        data={
          {
            ...data,
            issueCategory: IssueCategory.PERFORMANCE,
          } as BaseGroup
        }
        withStackTracePreview
      />
    );

    expect(screen.queryByTestId('stacktrace-preview')).not.toBeInTheDocument();
  });

  describe('performance issue list', () => {
    const perfData = {
      title: 'Hello',
      type: EventOrGroupType.TRANSACTION,
      issueCategory: IssueCategory.PERFORMANCE,
      metadata: {
        title: 'N+1 Query',
      },
      culprit: 'transaction name',
    } as BaseGroup;

    it('should correctly render title', () => {
      const routerContext = TestStubs.routerContext([
        {organization: TestStubs.Organization({features: ['custom-event-title']})},
      ]);

      render(<EventOrGroupTitle data={perfData} />, {context: routerContext});

      expect(screen.getByText('N+1 Query')).toBeInTheDocument();
      expect(screen.getByText('transaction name')).toBeInTheDocument();
    });
  });
});
