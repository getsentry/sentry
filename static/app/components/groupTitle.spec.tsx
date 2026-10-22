import {GroupFixture} from 'sentry-fixture/group';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {GroupTitle} from 'sentry/components/groupTitle';
import {EventOrGroupType} from 'sentry/types/event';
import {IssueCategory} from 'sentry/types/group';

describe('GroupTitle', () => {
  const data = {
    metadata: {
      type: 'metadata type',
      directive: 'metadata directive',
      uri: 'metadata uri',
    },
    culprit: 'culprit',
  };

  it('renders title for `type = error`', () => {
    render(<GroupTitle data={GroupFixture({...data, type: EventOrGroupType.ERROR})} />);

    expect(screen.getByText('metadata type')).toBeInTheDocument();
  });

  it('renders title for `type = csp`', () => {
    render(<GroupTitle data={GroupFixture({...data, type: EventOrGroupType.CSP})} />);

    expect(screen.getByText('metadata directive')).toBeInTheDocument();
  });

  it('renders title for `type = default`', () => {
    render(
      <GroupTitle
        data={GroupFixture({
          ...data,
          type: EventOrGroupType.DEFAULT,
          metadata: {...data.metadata, title: 'metadata title'},
        })}
      />
    );

    expect(screen.getByText('metadata title')).toBeInTheDocument();
  });

  it('renders with title override', () => {
    render(
      <GroupTitle
        data={GroupFixture({
          ...data,
          type: EventOrGroupType.ERROR,
          metadata: {...data.metadata, title: 'metadata title'},
        })}
      />
    );

    expect(screen.getByText('metadata title')).toBeInTheDocument();
  });

  it('renders colored text without escape codes when given an ANSI title', () => {
    const type = '\x1B[31mValueError\x1B[0m raised';

    render(
      <GroupTitle
        data={GroupFixture({...data, type: EventOrGroupType.ERROR, metadata: {type}})}
      />
    );

    expect(screen.getByText('ValueError').style.color).toContain('color-mix(in srgb,');
    expect(screen.getByText('ValueError').parentElement).toHaveTextContent(
      /^ValueError raised$/
    );
  });

  it('does not render stack trace when issueCategory is performance', () => {
    render(
      <GroupTitle
        data={GroupFixture({...data, issueCategory: IssueCategory.PERFORMANCE})}
        withStackTracePreview
      />
    );

    expect(screen.queryByTestId('stacktrace-preview')).not.toBeInTheDocument();
  });

  describe('performance issue list', () => {
    const perfData = GroupFixture({
      title: 'Hello',
      type: EventOrGroupType.TRANSACTION,
      issueCategory: IssueCategory.PERFORMANCE,
      metadata: {
        title: 'N+1 Query',
      },
      culprit: 'transaction name',
    });

    it('should correctly render title', () => {
      render(<GroupTitle data={perfData} />);

      expect(screen.getByText('N+1 Query')).toBeInTheDocument();
    });
  });
});
