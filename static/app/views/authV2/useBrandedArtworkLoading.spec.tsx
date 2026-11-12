import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {Text} from '@sentry/scraps/text';

import {ARTWORK_LAYERS} from 'sentry/components/brandPageLayout/artworkLayers';

import {useBrandedArtworkLoading} from './useBrandedArtworkLoading';

function ArtworkLoading() {
  const isLoading = useBrandedArtworkLoading();
  return <Text>{isLoading ? 'Loading artwork' : 'Artwork ready'}</Text>;
}

describe('useBrandedArtworkLoading', () => {
  const originalDecode = Object.getOwnPropertyDescriptor(
    HTMLImageElement.prototype,
    'decode'
  );
  const originalMatchMedia = window.matchMedia;
  const requests: Array<{
    reject: (error: Error) => void;
    resolve: () => void;
  }> = [];

  beforeEach(() => {
    requests.length = 0;
    jest.spyOn(window, 'matchMedia').mockImplementation(query => ({
      ...originalMatchMedia(query),
      matches: true,
    }));
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value(this: HTMLImageElement) {
        return new Promise<void>((resolve, reject) => {
          requests.push({resolve, reject});
        });
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();

    if (originalDecode) {
      Object.defineProperty(HTMLImageElement.prototype, 'decode', originalDecode);
    } else {
      Reflect.deleteProperty(HTMLImageElement.prototype, 'decode');
    }
  });

  it('starts all desktop requests immediately and waits for every image to decode', async () => {
    render(<ArtworkLoading />);
    expect(requests).toHaveLength(ARTWORK_LAYERS.length + 2);

    act(() => {
      requests.slice(1).forEach(request => request.resolve());
    });
    expect(screen.getByText('Loading artwork')).toBeInTheDocument();

    act(() => requests[0]!.resolve());
    expect(await screen.findByText('Artwork ready')).toBeInTheDocument();
  });

  it('finishes loading when an image fails to decode', async () => {
    render(<ArtworkLoading />);

    act(() => {
      requests[0]!.reject(new Error('Image failed to load'));
      requests.slice(1).forEach(request => request.resolve());
    });

    expect(await screen.findByText('Artwork ready')).toBeInTheDocument();
  });

  it('loads only the critter when the side illustration is hidden on mobile', async () => {
    jest.spyOn(window, 'matchMedia').mockImplementation(originalMatchMedia);
    render(<ArtworkLoading />);
    expect(requests).toHaveLength(1);

    act(() => requests[0]!.resolve());
    expect(await screen.findByText('Artwork ready')).toBeInTheDocument();
  });
});
