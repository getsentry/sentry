import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {AnimatedIllustration} from './animatedIllustration';
import {BrandPageBackground} from './background';

const observers: Array<{
  callback: IntersectionObserverCallback;
  observer: IntersectionObserver;
  target: Element;
}> = [];

function setInView(isIntersecting: boolean) {
  act(() => {
    for (const {callback, observer, target} of observers) {
      callback(
        [
          {
            target,
            isIntersecting,
            intersectionRatio: isIntersecting ? 1 : 0,
            boundingClientRect: new DOMRect(0, 0, 100, 100),
            intersectionRect: new DOMRect(0, 0, 100, 100),
            rootBounds: null,
            time: 0,
          },
        ],
        observer
      );
    }
  });
}

function getCharacter(id: string) {
  const image = screen
    .getByTestId('animated-illustration')
    .querySelector<HTMLImageElement>(`[data-artwork-layer="${id}"] img`);

  if (!image) {
    throw new Error(`Character ${id} is not rendered`);
  }

  return image;
}

describe('AnimatedIllustration', () => {
  const OriginalIntersectionObserver = window.IntersectionObserver;

  beforeEach(() => {
    observers.length = 0;
    window.IntersectionObserver = class extends OriginalIntersectionObserver {
      callback: IntersectionObserverCallback;

      constructor(
        callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit
      ) {
        super(callback, options);
        this.callback = callback;
      }

      override observe(target: Element) {
        observers.push({callback: this.callback, observer: this, target});
      }
    };
    jest.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    jest.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(300);
  });

  afterEach(() => {
    window.IntersectionObserver = OriginalIntersectionObserver;
    jest.restoreAllMocks();
  });

  it('defers image requests until the artwork becomes visible', async () => {
    render(<AnimatedIllustration />);
    const artwork = screen.getByTestId('animated-illustration');
    expect(artwork.querySelector('img')).toBeNull();

    setInView(true);

    expect(getCharacter('bird')).toBeInTheDocument();
    await waitFor(() =>
      expect(getCharacter('bird')).toHaveStyle({animationPlayState: 'running'})
    );
  });

  it('starts ambient playback with images already in the browser cache', async () => {
    render(<AnimatedIllustration />);
    setInView(true);

    await waitFor(() =>
      expect(getCharacter('bird')).toHaveStyle({animationPlayState: 'running'})
    );
    expect(getCharacter('wizard')).toHaveStyle({animationPlayState: 'paused'});
  });

  it('plays characters on hover and holds their frame when the pointer leaves', async () => {
    render(<AnimatedIllustration />);
    setInView(true);
    await waitFor(() =>
      expect(getCharacter('bird')).toHaveStyle({animationPlayState: 'running'})
    );

    const wizard = getCharacter('wizard');
    await userEvent.hover(wizard);
    expect(wizard).toHaveStyle({animationPlayState: 'running'});

    await userEvent.unhover(wizard);
    expect(wizard).toHaveStyle({animationPlayState: 'paused'});
  });

  it('switches the cat to its reaction frame on hover', async () => {
    render(<AnimatedIllustration />);
    setInView(true);
    const cat = getCharacter('cat');

    await userEvent.hover(cat);
    expect(cat).toHaveStyle({objectPosition: '100% 0%'});

    await userEvent.unhover(cat);
    expect(cat).toHaveStyle({objectPosition: '0% 0%'});
  });

  it('plays both characters when their hover areas overlap', async () => {
    render(<AnimatedIllustration />);
    setInView(true);
    await waitFor(() =>
      expect(getCharacter('bird')).toHaveStyle({animationPlayState: 'running'})
    );

    const wizard = getCharacter('wizard');
    const runner = getCharacter('running-error');
    jest
      .spyOn(wizard, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(10, 10, 100, 100));
    jest
      .spyOn(runner, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(60, 60, 100, 100));

    await userEvent.pointer({target: wizard, coords: {clientX: 80, clientY: 80}});
    expect(wizard).toHaveStyle({animationPlayState: 'running'});
    expect(runner).toHaveStyle({animationPlayState: 'running'});

    await userEvent.pointer({target: wizard, coords: {clientX: 20, clientY: 20}});
    expect(wizard).toHaveStyle({animationPlayState: 'running'});
    expect(runner).toHaveStyle({animationPlayState: 'paused'});

    await userEvent.unhover(wizard);
    expect(wizard).toHaveStyle({animationPlayState: 'paused'});
    expect(runner).toHaveStyle({animationPlayState: 'paused'});
  });

  it('pauses offscreen playback and resumes when the artwork returns', async () => {
    render(<AnimatedIllustration />);
    setInView(true);
    await waitFor(() =>
      expect(getCharacter('bird')).toHaveStyle({animationPlayState: 'running'})
    );

    setInView(false);
    expect(getCharacter('bird')).toHaveStyle({animationPlayState: 'paused'});

    setInView(true);
    expect(getCharacter('bird')).toHaveStyle({animationPlayState: 'running'});
  });

  it('pauses background tabs and resumes when the page becomes visible', async () => {
    render(<AnimatedIllustration />);
    setInView(true);
    await waitFor(() =>
      expect(getCharacter('bird')).toHaveStyle({animationPlayState: 'running'})
    );

    const hidden = jest.spyOn(document, 'hidden', 'get');
    hidden.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(getCharacter('bird')).toHaveStyle({animationPlayState: 'paused'});

    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(getCharacter('bird')).toHaveStyle({animationPlayState: 'running'});
  });

  it('finishes the entrance when an asset fails to load', async () => {
    jest.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);
    render(<AnimatedIllustration />);
    setInView(true);
    const wizard = getCharacter('wizard');

    act(() => {
      for (const image of screen
        .getByTestId('animated-illustration')
        .querySelectorAll('img')) {
        image.dispatchEvent(new Event(image === wizard ? 'error' : 'load'));
      }
    });

    await waitFor(() =>
      expect(getCharacter('bird')).toHaveStyle({animationPlayState: 'running'})
    );
    await waitFor(() =>
      expect(wizard.closest('[data-artwork-layer]')).toHaveStyle({opacity: 0})
    );
  });

  it('defers the nebula image until the background is visible', () => {
    render(<BrandPageBackground />);
    const background = screen.getByTestId('brand-art-background');
    expect(background.querySelector('image')).toBeNull();

    setInView(true);

    expect(background.querySelector('image')).toHaveAttribute('href');
  });

  it('pauses SVG star twinkles outside the viewport and in background tabs', () => {
    render(<BrandPageBackground />);
    setInView(true);
    const star = screen
      .getByTestId('brand-art-background')
      .querySelector('[data-twinkle]');
    expect(star).toHaveStyle({animationPlayState: 'running'});

    setInView(false);
    expect(star).toHaveStyle({animationPlayState: 'paused'});

    setInView(true);
    expect(star).toHaveStyle({animationPlayState: 'running'});

    const hidden = jest.spyOn(document, 'hidden', 'get');
    hidden.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(star).toHaveStyle({animationPlayState: 'paused'});

    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(star).toHaveStyle({animationPlayState: 'running'});
  });
});
