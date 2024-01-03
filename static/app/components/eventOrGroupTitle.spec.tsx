import {Organization} from 'sentry-fixture/organization';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';
import {User} from 'sentry-fixture/user';

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
    render(
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
  });

  it('renders with subtitle when `type = csp`', function () {
    render(
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
  });

  it('renders with no subtitle when `type = default`', function () {
    render(
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
  });

  it('renders with title override', function () {
    const routerContext = RouterContextFixture([{organization: Organization()}]);

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

  it('does not render stacktrace preview when data is a tombstone', () => {
    render(
      <EventOrGroupTitle
        data={{
          id: '123',
          level: 'error',
          message: 'numTabItems is not defined ReferenceError something',
          culprit:
            'useOverflowTabs(webpack-internal:///./app/components/tabs/tabList.tsx)',
          type: EventOrGroupType.ERROR,
          metadata: {
            value: 'numTabItems is not defined',
            type: 'ReferenceError',
            filename: 'webpack-internal:///./app/components/tabs/tabList.tsx',
            function: 'useOverflowTabs',
            display_title_with_tree_label: false,
          },
          actor: User(),
          isTombstone: true,
        }}
        withStackTracePreview
      />
    );

    expect(screen.queryByTestId('stacktrace-preview')).not.toBeInTheDocument();
    expect(screen.getByText('ReferenceError')).toBeInTheDocument();
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
      const routerContext = RouterContextFixture([{organization: Organization()}]);

      render(<EventOrGroupTitle data={perfData} />, {context: routerContext});

      expect(screen.getByText('N+1 Query')).toBeInTheDocument();
      expect(screen.getByText('transaction name')).toBeInTheDocument();
    });
  });
});
