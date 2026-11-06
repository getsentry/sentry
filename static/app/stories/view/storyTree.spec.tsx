import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {CategorizedStoryTree} from './storyTree';

jest.mock('sentry/stories/storyManifest.generated', () => ({
  storyFiles: [
    'app/components/core/avatar/avatar.mdx',
    'packages/scraps/src/drawer/drawer.mdx',
    'gsApp/components/upsellModal/upsellModal.stories.tsx',
  ],
  storyFrontmatterIndex: {
    'app/components/core/avatar/avatar.mdx': {
      category: 'display',
      title: 'Avatar',
    },
    'packages/scraps/src/drawer/drawer.mdx': {
      category: 'overlays',
      title: 'GlobalDrawer',
    },
  },
}));

jest.mock('sentry/stories/view/useStoryParams', () => ({
  useStoryParams: () => ({}),
}));

function getSection(name: string) {
  return screen.getByRole('heading', {name}).parentElement!;
}

describe('CategorizedStoryTree', () => {
  afterEach(() => {
    ConfigStore.set('sentryMode', 'SAAS');
  });

  it('routes app and Scraps package docs to core by filename, not title', async () => {
    render(<CategorizedStoryTree />);

    await userEvent.click(screen.getByText('Display'));
    await userEvent.click(screen.getByText('Overlays'));

    expect(screen.getByRole('link', {name: 'Avatar'})).toHaveAttribute(
      'href',
      expect.stringContaining('/scraps/core/avatar/')
    );
    expect(screen.getByRole('link', {name: 'GlobalDrawer'})).toHaveAttribute(
      'href',
      expect.stringContaining('/scraps/core/drawer/')
    );
  });

  it('lists gsApp stories in their own section', async () => {
    ConfigStore.set('sentryMode', 'SAAS');
    render(<CategorizedStoryTree />);

    const gsApp = getSection('gsApp');
    await userEvent.click(within(gsApp).getByText('Components'));
    await userEvent.click(within(gsApp).getByText('UpsellModal'));

    expect(within(gsApp).getByRole('link', {name: 'UpsellModal'})).toHaveAttribute(
      'href',
      expect.stringContaining('/scraps/gsApp/components/upsellmodal/upsellmodal/')
    );
  });

  it('hides gsApp stories on self-hosted', () => {
    ConfigStore.set('sentryMode', 'SELF_HOSTED');
    render(<CategorizedStoryTree />);

    expect(screen.getByRole('heading', {name: 'Components'})).toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: 'gsApp'})).not.toBeInTheDocument();
  });
});
