import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {EmbedStory} from './embedStory';

describe('EmbedStory', () => {
  it('labels the sections without adding headings to the table of contents', () => {
    render(<EmbedStory name="dsn" />);

    // The levels `storyTableOfContents` collects the right-hand nav from. Real
    // headings here would put four entries per embed in the sidebar.
    for (const level of [2, 3, 4, 5, 6]) {
      expect(screen.queryByRole('heading', {level})).not.toBeInTheDocument();
    }
  });

  it('serializes the markdown from the tag alone, without the demo prose', () => {
    render(<EmbedStory name="dsn" />);

    const section = screen.getByText('Markdown').parentElement!;

    expect(within(section).getByText(/examplePublicKey/)).toBeInTheDocument();
    expect(within(section).queryByText(/Lorem ipsum/)).not.toBeInTheDocument();
  });
});
