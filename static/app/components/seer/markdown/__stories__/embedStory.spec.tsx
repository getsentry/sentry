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
    expect(await screen.findByRole('heading', {name: 'Tag'})).toBeInTheDocument();
    expect(await screen.findByRole('heading', {name: 'Inline'})).toBeInTheDocument();
    expect(await screen.findByRole('heading', {name: 'Block'})).toBeInTheDocument();
    expect(await screen.findByRole('heading', {name: 'Markdown'})).toBeInTheDocument();
  });

  it('omits the level an embed does not declare', () => {
    // `dsn` is block only.
    render(<EmbedStory name="dsn" />);

    expect(screen.getByRole('heading', {name: 'Block'})).toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: 'Inline'})).not.toBeInTheDocument();
  });

  it('serializes the markdown from the tag alone, without the demo prose', () => {
    render(<EmbedStory name="dsn" />);

    const section = screen.getByRole('heading', {name: 'Markdown'}).parentElement!;

    expect(within(section).getByText(/examplePublicKey/)).toBeInTheDocument();
    expect(within(section).queryByText(/Lorem ipsum/)).not.toBeInTheDocument();
    expect(within(section).queryByText(/Block:/)).not.toBeInTheDocument();
  });
});
