import {Fragment, useState} from 'react';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {IssueDetailsContextProvider, SectionKey} from './context';
import {FoldSection} from './foldSection';
import {IssueDetailsJumpTo} from './issueDetailsJumpTo';

describe('IssueDetailsJumpTo', () => {
  function additionalWrapper({children}: {children: React.ReactNode}) {
    return <IssueDetailsContextProvider>{children}</IssueDetailsContextProvider>;
  }

  it('renders jump-to links in the order sections appear', async () => {
    render(
      <Fragment>
        <IssueDetailsJumpTo />
        {/* Render sections in a specific DOM order */}
        <FoldSection title="Highlights" sectionKey={SectionKey.HIGHLIGHTS}>
          <div>Highlights content</div>
        </FoldSection>
        <FoldSection title="Replay" sectionKey={SectionKey.REPLAY}>
          <div>Replay content</div>
        </FoldSection>
        <FoldSection title="Tags" sectionKey={SectionKey.TAGS}>
          <div>Tags content</div>
        </FoldSection>
      </Fragment>,
      {additionalWrapper}
    );

    expect(await screen.findByText('Jump to:')).toBeInTheDocument();
    // Wait for all expected links to be present
    expect(await screen.findByRole('button', {name: 'Highlights'})).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'Replay'})).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'Tags'})).toBeInTheDocument();

    // Verify order by reading links as they appear in the Jump To carousel
    const nav = screen.getByLabelText('Jump to section links');
    const links = within(nav).getAllByRole('button');
    expect(links.map(l => l.textContent)).toEqual(['Highlights', 'Replay', 'Tags']);
  });

  it('removes a jump-to link when its section unmounts', async () => {
    function TestHarness() {
      const [showTags, setShowTags] = useState(true);
      return (
        <Fragment>
          <button onClick={() => setShowTags(s => !s)}>Toggle Tags</button>
          <IssueDetailsJumpTo />
          <FoldSection title="Highlights" sectionKey={SectionKey.HIGHLIGHTS}>
            <div>Highlights content</div>
          </FoldSection>
          {showTags ? (
            <FoldSection title="Tags" sectionKey={SectionKey.TAGS}>
              <div>Tags content</div>
            </FoldSection>
          ) : null}
        </Fragment>
      );
    }

    render(<TestHarness />, {additionalWrapper});

    expect(await screen.findByText('Jump to:')).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'Tags'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Toggle Tags'}));

    await waitFor(() => {
      expect(screen.queryByRole('button', {name: 'Tags'})).not.toBeInTheDocument();
    });
  });
});
