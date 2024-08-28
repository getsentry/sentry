import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import {EventOrGroupType} from 'sentry/types/event';
import type {BaseGroup} from 'sentry/types/group';
import {IssueCategory} from 'sentry/types/group';

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
      />
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
          },
          actor: UserFixture(),
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
      render(<EventOrGroupTitle data={perfData} />);

      expect(screen.getByText('N+1 Query')).toBeInTheDocument();
      expect(screen.getByText('transaction name')).toBeInTheDocument();
    });
  });
});
