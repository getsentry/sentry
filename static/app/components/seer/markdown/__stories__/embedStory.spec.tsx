import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {EmbedStory} from './embedStory';

describe('EmbedStory', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    // The `issue` block is a real GroupList; an empty list is enough to render.
    MockApiClient.addMockResponse({url: '/organizations/org-slug/issues/', body: []});
    MockApiClient.addMockResponse({url: '/organizations/org-slug/users/', body: []});
  });

  it('shows the tag, both document levels and the markdown form', async () => {
    // `issue` is one of the embeds whose schema declares inline and block.
    render(<EmbedStory name="issue" />);

    // Awaited so the block's lazily loaded preview settles inside the test.
    expect(await screen.findByText('Tag')).toBeInTheDocument();
    expect(await screen.findByText('Inline')).toBeInTheDocument();
    expect(await screen.findByText('Block')).toBeInTheDocument();
    expect(await screen.findByText('Markdown')).toBeInTheDocument();
  });

  it('labels the sections without adding headings to the table of contents', () => {
    render(<EmbedStory name="dsn" />);

    // The levels `storyTableOfContents` collects the right-hand nav from.
    for (const level of [2, 3, 4, 5, 6]) {
      expect(screen.queryByRole('heading', {level})).not.toBeInTheDocument();
    }
  });

  it('omits the level an embed does not declare', () => {
    // `dsn` is block only.
    render(<EmbedStory name="dsn" />);

    expect(screen.getByText('Block')).toBeInTheDocument();
    expect(screen.queryByText('Inline')).not.toBeInTheDocument();
  });

  it('drops the example label when the section already names it', () => {
    render(<EmbedStory name="dsn" />);

    // The schema's single example is labelled "DSN", which would repeat the
    // `### dsn` heading the mdx already renders above it.
    expect(screen.queryByText('DSN')).not.toBeInTheDocument();
  });

  it('serializes the markdown from the tag alone, without the demo prose', () => {
    render(<EmbedStory name="dsn" />);

    const section = screen.getByText('Markdown').parentElement!;

    expect(within(section).getByText(/examplePublicKey/)).toBeInTheDocument();
    expect(within(section).queryByText(/Lorem ipsum/)).not.toBeInTheDocument();
    expect(within(section).queryByText(/Block:/)).not.toBeInTheDocument();
  });
});
