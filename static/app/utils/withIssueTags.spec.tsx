import {Organization} from 'sentry-fixture/organization';
import {Team} from 'sentry-fixture/team';
import {User} from 'sentry-fixture/user';

import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import type {SearchGroup} from 'sentry/components/smartSearchBar/types';
import MemberListStore from 'sentry/stores/memberListStore';
import TagStore from 'sentry/stores/tagStore';
import TeamStore from 'sentry/stores/teamStore';
import withIssueTags, {WithIssueTagsProps} from 'sentry/utils/withIssueTags';

interface MyComponentProps extends WithIssueTagsProps {
  forwardedValue: string;
}
function MyComponent(props: MyComponentProps) {
  return (
    <div>
      ForwardedValue: {props.forwardedValue}
      {'is: ' + props.tags?.is?.values?.[0]}
      {'mechanism: ' + props.tags?.mechanism?.values?.join(', ')}
      {'bookmarks: ' + props.tags?.bookmarks?.values?.join(', ')}
      {'assigned: ' +
        (props.tags?.assigned?.values as SearchGroup[])
          .flatMap(x => x.children)
          .map(x => x.desc)
          ?.join(', ')}
      {'stack filename: ' + props.tags?.['stack.filename'].name}
    </div>
  );
}

describe('withIssueTags HoC', function () {
  beforeEach(() => {
    TeamStore.reset();
    TagStore.reset();
    MemberListStore.loadInitialData([]);
  });

  it('forwards loaded tags to the wrapped component', async function () {
    const Container = withIssueTags(MyComponent);
    render(<Container organization={Organization()} forwardedValue="value" />);

    // Should forward props.
    expect(await screen.findByText(/ForwardedValue: value/)).toBeInTheDocument();

    act(() => {
      TagStore.loadTagsSuccess([
        {name: 'MechanismTag', key: 'mechanism', values: ['MechanismTagValue']},
      ]);
    });

    // includes custom tags
    await waitFor(() => {
      expect(screen.getByText(/MechanismTagValue/)).toBeInTheDocument();
    });

    // should include special issue and attributes.
    expect(screen.getByText(/is: resolved/)).toBeInTheDocument();
    expect(screen.getByText(/bookmarks: me/)).toBeInTheDocument();
    expect(screen.getByText(/assigned: me/)).toBeInTheDocument();
    expect(screen.getByText(/stack filename: stack.filename/)).toBeInTheDocument();
  });

  it('updates the assigned tags with users and teams, and bookmark tags with users', function () {
    const Container = withIssueTags(MyComponent);
    render(<Container organization={Organization()} forwardedValue="value" />);

    act(() => {
      TagStore.loadTagsSuccess([
        {name: 'MechanismTag', key: 'mechanism', values: ['MechanismTagValue']},
      ]);
    });

    expect(
      screen.getByText(/assigned: me, my_teams, \[me, my_teams, none\]/)
    ).toBeInTheDocument();

    act(() => {
      TeamStore.loadInitialData([
        Team({slug: 'best-team-na', name: 'Best Team NA', isMember: true}),
      ]);
      MemberListStore.loadInitialData([User(), User({username: 'joe@example.com'})]);
    });

    expect(
      screen.getByText(
        /assigned: me, my_teams, \[me, my_teams, none\], #best-team-na, foo@example.com, joe@example.com/
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(/bookmarks: me, foo@example.com, joe@example.com/)
    ).toBeInTheDocument();
  });

  it('groups assignees and puts suggestions first', function () {
    const Container = withIssueTags(MyComponent);
    TeamStore.loadInitialData([
      Team({id: '1', slug: 'best-team', name: 'Best Team', isMember: true}),
      Team({id: '2', slug: 'worst-team', name: 'Worst Team', isMember: false}),
    ]);
    MemberListStore.loadInitialData([User(), User({username: 'joe@example.com'})]);
    const {container} = render(
      <Container organization={Organization()} forwardedValue="value" />
    );

    expect(container).toHaveTextContent(
      'assigned: me, my_teams, [me, my_teams, none], #best-team'
    );
    // Has the other teams/members
    expect(container).toHaveTextContent('foo@example.com, joe@example.com, #worst-team');
  });
});
