import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {StorySearch} from './storySearch';

// The viewer loads Rspack's import.meta HMR module; search only needs its tree.
jest.mock('sentry/stories/view', () => ({}));

jest.mock('sentry/stories/storyManifest.generated', () => ({
  storyFiles: [
    'app/components/core/badge/badge.mdx',
    'app/components/core/badge/tag.mdx',
    'app/components/example.stories.tsx',
  ],
  storyFrontmatterIndex: {
    'app/components/core/badge/badge.mdx': {category: 'status', title: 'Badge'},
    'app/components/core/badge/tag.mdx': {category: 'status', title: 'Tag'},
  },
  storyHeadingIndex: {
    'app/components/core/badge/badge.mdx': [
      {id: 'featurebadge', title: 'FeatureBadge', parents: []},
      {
        id: 'featurebadge-accessibility',
        title: 'Accessibility',
        parents: ['FeatureBadge'],
      },
      {id: 'tag', title: 'Tag', parents: []},
      {id: 'tag-accessibility', title: 'Accessibility', parents: ['Tag']},
    ],
    'app/components/core/badge/tag.mdx': [],
  },
}));

describe('StorySearch', () => {
  beforeEach(() => {
    // jsdom has no layout; give the real virtualized list a visible viewport.
    jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(320);
    jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(320);
  });
  it('finds a nested component and navigates to its section by keyboard', async () => {
    const {router} = render(<StorySearch />);
    await userEvent.type(
      screen.getByRole('combobox', {name: 'Search stories'}),
      'FeatureBadge'
    );

    expect(
      await screen.findByRole('option', {name: 'Badge › FeatureBadge'})
    ).toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(router.location.hash).toBe('#featurebadge'));
    expect(router.location.pathname).toContain('/scraps/core/badge/');
  });

  it('distinguishes repeated section titles and navigates to the chosen anchor', async () => {
    const {router} = render(<StorySearch />);
    await userEvent.type(
      screen.getByRole('combobox', {name: 'Search stories'}),
      'Accessibility'
    );

    expect(
      await screen.findByRole('option', {name: /Badge › FeatureBadge › Accessibility/})
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('option', {name: /Badge › Tag › Accessibility/})
    );
    await waitFor(() => expect(router.location.hash).toBe('#tag-accessibility'));
  });

  it('ranks the standalone page ahead of an equally named section and clears the hash', async () => {
    const {router} = render(<StorySearch />, {
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/scraps/core/badge/?tab=api#featurebadge',
        },
      },
    });
    await userEvent.type(screen.getByRole('combobox', {name: 'Search stories'}), 'Tag');

    const options = await screen.findAllByRole('option');
    expect(options[0]).toHaveTextContent(/^Tag/);
    await userEvent.click(options[0]!);
    await waitFor(() => expect(router.location.pathname).toContain('/scraps/core/tag/'));
    expect(router.location.hash).toBe('');
    expect(router.location.query).toEqual({});
  });

  it('retains page-only browsing and legacy TS stories', async () => {
    const {router} = render(<StorySearch />);
    const input = screen.getByRole('combobox', {name: 'Search stories'});
    await userEvent.click(input);
    expect(screen.queryByRole('option', {name: /FeatureBadge/})).not.toBeInTheDocument();
    await userEvent.type(input, 'Example');
    await userEvent.click(await screen.findByRole('option', {name: 'Example'}));
    await waitFor(() =>
      expect(router.location.pathname).toContain('/scraps/product/components/example/')
    );
  });

  it('shows no results for unmatched queries', async () => {
    render(<StorySearch />);
    await userEvent.type(
      screen.getByRole('combobox', {name: 'Search stories'}),
      'zzzzzzzz'
    );
    expect(await screen.findByText('No stories match "zzzzzzzz"')).toBeInTheDocument();
  });
});
