import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import PlatformPicker from 'sentry/components/platformPicker';
import {gaming} from 'sentry/data/platformCategories';
import {trackAnalytics} from 'sentry/utils/analytics';

jest.mock('sentry/utils/analytics');

describe('PlatformPicker', () => {
  const baseProps = {
    platform: '',
    setPlatform: () => {},
    location: {query: {}},
  };

  it('should only render Mobile platforms under Mobile tab', () => {
    render(<PlatformPicker {...baseProps} defaultCategory="mobile" />);

    expect(screen.queryByTestId('platform-java')).not.toBeInTheDocument();
    expect(screen.getByTestId('platform-apple-ios')).toBeInTheDocument();
    expect(screen.getByTestId('platform-react-native')).toBeInTheDocument();
  });

  it('should render renderPlatformList with Python when filtered with py', () => {
    render(<PlatformPicker {...baseProps} defaultCategory="all" platform="py" />);

    expect(screen.queryByTestId('platform-java')).not.toBeInTheDocument();
    expect(screen.getByTestId('platform-python-flask')).toBeInTheDocument();
  });

  it('should render renderPlatformList with Native when filtered with c++ alias', () => {
    render(<PlatformPicker {...baseProps} defaultCategory="all" platform="c++" />);

    expect(screen.getByTestId('platform-native')).toBeInTheDocument();
  });

  it('should render renderPlatformList with community SDKs message if platform not found', async () => {
    render(<PlatformPicker {...baseProps} />);

    await userEvent.type(screen.getByPlaceholderText('Filter Platforms'), 'aaaaaa');

    expect(screen.getByText("We don't have an SDK for that yet!")).toBeInTheDocument();
  });

  it('should update State.tab onClick when particular tab is clicked', async () => {
    render(<PlatformPicker {...baseProps} />);

    expect(screen.getByText('Popular')).toBeInTheDocument();

    await userEvent.click(screen.getByText('All'));
    expect(trackAnalytics).toHaveBeenCalledWith(
      'growth.platformpicker_category',
      expect.objectContaining({
        category: 'all',
      })
    );
  });

  it('should clear the platform when clear is clicked', async () => {
    const props = {
      ...baseProps,
      platform: 'javascript-react',
      setPlatform: jest.fn(),
    };

    render(<PlatformPicker noAutoFilter {...props} />);

    await userEvent.click(screen.getByRole('button', {name: 'Clear'}));
    expect(props.setPlatform).toHaveBeenCalledWith(null);
  });

  it('platforms shall be sorted alphabetically', () => {
    render(<PlatformPicker setPlatform={jest.fn()} defaultCategory="browser" />);

    const alphabeticallyOrderedPlatformNames = [
      'Angular',
      'Astro',
      'Browser JavaScript',
      'Dart',
      'Ember',
      'Flutter',
      'Gatsby',
      'Next.js',
      'Nuxt',
      'React',
      'React Native',
      'React Router Framework',
      'Remix',
      'Solid',
      'SolidStart',
      'Svelte',
      'SvelteKit',
      'TanStack Start React',
      'Unity',
      'Vue',
    ];

    const platformNames = screen.getAllByRole('heading', {level: 3});

    platformNames.forEach((platform, index) => {
      expect(platform).toHaveTextContent(alphabeticallyOrderedPlatformNames[index]!);
    });
  });

  it('"other" platform shall be rendered if filter contains it', async () => {
    render(<PlatformPicker setPlatform={jest.fn()} />);

    expect(screen.queryByTestId('platform-other')).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox'), 'Oth');

    expect(screen.queryByTestId('platform-other')).not.toBeInTheDocument();

    // complete the word 'other'
    await userEvent.type(screen.getByRole('textbox'), 'er');

    expect(screen.getByTestId('platform-other')).toBeInTheDocument();
  });

  it('shows gaming tab and consoles', async () => {
    render(<PlatformPicker setPlatform={jest.fn()} />);

    await userEvent.click(screen.getByRole('tab', {name: 'Gaming'}));

    for (const platform of gaming) {
      expect(screen.getByTestId(`platform-${platform}`)).toBeInTheDocument();
    }

    await userEvent.click(screen.getByRole('tab', {name: 'Browser'}));

    await userEvent.type(screen.getByPlaceholderText('Filter Platforms'), 'play');

    expect(screen.getByTestId(`platform-playstation`)).toBeInTheDocument();
  });
});
