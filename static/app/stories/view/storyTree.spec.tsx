import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {CategorizedStoryTree} from 'sentry/stories/view/storyTree';

jest.mock('sentry/stories/storyManifest.generated', () => ({
  storyFiles: ['app/components/core/drawer/drawer.mdx'],
  storyFrontmatterIndex: {
    'app/components/core/drawer/drawer.mdx': {
      category: 'overlays',
      title: 'GlobalDrawer',
    },
  },
}));

jest.mock('sentry/stories/view', () => ({
  useStoryParams: () => ({}),
}));

describe('CategorizedStoryTree', () => {
  it('uses the documented title without changing the filename-based route', async () => {
    render(<CategorizedStoryTree />);

    await userEvent.click(screen.getByText('Overlays'));

    expect(screen.getByRole('link', {name: 'GlobalDrawer'})).toHaveAttribute(
      'href',
      expect.stringContaining('/scraps/core/drawer/')
    );
  });
});
