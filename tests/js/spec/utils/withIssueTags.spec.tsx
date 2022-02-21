import {act, mountWithTheme, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import MemberListStore from 'sentry/stores/memberListStore';
import TagStore from 'sentry/stores/tagStore';
import TeamStore from 'sentry/stores/teamStore';
import withIssueTags, {WithIssueTagsProps} from 'sentry/utils/withIssueTags';

interface MyComponentProps extends WithIssueTagsProps {
  forwardedValue: string;
}
const MyComponent = (props: MyComponentProps) => {
  return (
    <div>
      ForwardedValue: {props.forwardedValue}
      {'is: ' + props.tags?.is?.values?.[0]}
      {'mechanism: ' + props.tags?.mechanism?.values?.join(', ')}
      {'bookmarks: ' + props.tags?.bookmarks?.values?.join(', ')}
      {'assigned: ' + props.tags?.assigned?.values?.join(', ')}
      {'stack filename: ' + props.tags?.['stack.filename'].name}
    </div>
  );
};

describe('withIssueTags HoC', function () {
  beforeEach(() => {
    TagStore.reset();
    MemberListStore.loadInitialData([]);
  });

  it('forwards loaded tags to the wrapped component', async function () {
    const Container = withIssueTags(MyComponent);
    mountWithTheme(<Container forwardedValue="value" />);

    // Should forward props.
    expect(await screen.findByText(/ForwardedValue: value/)).toBeInTheDocument();

    act(() => {
      TagStore.onLoadTagsSuccess([
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

  it('updates the assigned tags with users and teams, and bookmark tags with users', async function () {
    const Container = withIssueTags(MyComponent);
    mountWithTheme(<Container forwardedValue="value" />);

    act(() => {
      TagStore.onLoadTagsSuccess([
        {name: 'MechanismTag', key: 'mechanism', values: ['MechanismTagValue']},
      ]);
    });

    expect(screen.getByText(/assigned: me, \[me, none\]/)).toBeInTheDocument();

    act(() => {
      TeamStore.loadInitialData([
        TestStubs.Team({slug: 'best-team-na', name: 'Best Team NA', isMember: true}),
      ]);
      MemberListStore.loadInitialData([
        TestStubs.User(),
        TestStubs.User({username: 'joe@example.com'}),
      ]);
    });

    expect(
      screen.getByText(
        /assigned: me, \[me, none\], foo@example.com, joe@example.com, #best-team-na/
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(/bookmarks: me, foo@example.com, joe@example.com/)
    ).toBeInTheDocument();
  });
});
