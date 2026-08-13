import {GroupFixture} from 'sentry-fixture/group';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {GroupTitle} from 'sentry/components/groupTitle';

describe('GroupPreviewHovercard', () => {
  it('anchors to the visible width of a truncated title', () => {
    const group = GroupFixture({
      metadata: {type: 'A very long issue title that overflows its container'},
    });

    render(<GroupTitle data={group} withStackTracePreview />);

    // The hovercard positions itself against the wrapper the hover overlay puts
    // around the trigger. Group titles are truncated by an ancestor, so this
    // wrapper has to truncate too -- an inline wrapper ignores the max-width
    // the overlay sets on it and reports a layout box wider than the title
    // actually renders, which pushes the hovercard off past the visible edge.
    const wrapper = screen.getByText(
      'A very long issue title that overflows its container'
    ).parentElement;

    expect(wrapper).toHaveStyle({
      display: 'inline-block',
      maxWidth: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    });
  });
});
