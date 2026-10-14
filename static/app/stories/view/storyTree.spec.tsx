import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {CategorizedStoryTree} from 'sentry/stories/view/storyTree';

jest.mock('sentry/stories/storyManifest.generated', () => ({
  storyFiles: [
    'app/components/core/drawer/drawer.mdx',
    'gsAdmin/components/customerStatus.stories.tsx',
    'gsApp/components/upsellModal/upsellModal.stories.tsx',
  ],
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

function getSection(name: string) {
  return screen.getByRole('heading', {name}).parentElement!;
}

describe('CategorizedStoryTree', () => {
  afterEach(() => {
    ConfigStore.set('sentryMode', 'SAAS');
  });

  it('uses the documented title without changing the filename-based route', async () => {
    render(<CategorizedStoryTree />);

    await userEvent.click(screen.getByText('Overlays'));

    expect(screen.getByRole('link', {name: 'GlobalDrawer'})).toHaveAttribute(
      'href',
      expect.stringContaining('/scraps/core/drawer/')
    );
  });

  it('lists getsentry stories in their own sections', async () => {
    ConfigStore.set('sentryMode', 'SAAS');
    render(<CategorizedStoryTree />);

    expect(screen.getByRole('heading', {name: 'gsAdmin'})).toBeInTheDocument();

    const gsApp = getSection('gsApp');
    await userEvent.click(within(gsApp).getByText('Components'));
    await userEvent.click(within(gsApp).getByText('UpsellModal'));

    expect(within(gsApp).getByRole('link', {name: 'UpsellModal'})).toHaveAttribute(
      'href',
      expect.stringContaining('/scraps/gsApp/components/upsellmodal/upsellmodal/')
    );
  });

  it('hides getsentry stories on self-hosted', () => {
    ConfigStore.set('sentryMode', 'SELF_HOSTED');
    render(<CategorizedStoryTree />);

    expect(screen.getByRole('heading', {name: 'Components'})).toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: 'gsApp'})).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: 'gsAdmin'})).not.toBeInTheDocument();
  });
});
