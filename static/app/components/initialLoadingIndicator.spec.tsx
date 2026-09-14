import {render, screen} from 'sentry-test/reactTestingLibrary';

import {InitialLoadingIndicator} from 'sentry/components/initialLoadingIndicator';
import {ROOT_ELEMENT} from 'sentry/constants';

describe('InitialLoadingIndicator', () => {
  let root: HTMLElement;
  let originalGetAnimationsDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalGetAnimationsDescriptor = Object.getOwnPropertyDescriptor(
      Element.prototype,
      'getAnimations'
    );
    root = document.createElement('div');
    root.id = ROOT_ELEMENT;
    document.body.appendChild(root);
  });

  afterEach(() => {
    if (originalGetAnimationsDescriptor) {
      Object.defineProperty(
        Element.prototype,
        'getAnimations',
        originalGetAnimationsDescriptor
      );
    } else {
      Reflect.deleteProperty(Element.prototype, 'getAnimations');
    }
    root.remove();
  });

  it('reuses the server-rendered loader', () => {
    root.innerHTML = `
      <main>Current application content</main>
      <div class="splash-loader" style="display: none">Inactive loader</div>
      <div class="splash-loader">
        <div data-test-id="server-loader">Loading Sentry</div>
      </div>
    `;

    render(<InitialLoadingIndicator fallback={<div>Fallback loader</div>} />);
    root.replaceChildren();

    const loader = screen.getByTestId('server-loader');
    expect(loader).toHaveTextContent('Loading Sentry');
    expect(loader.closest('.splash-loader')).toBeInTheDocument();
    expect(screen.queryByText('Inactive loader')).not.toBeInTheDocument();
    expect(screen.queryByText('Current application content')).not.toBeInTheDocument();
    expect(screen.queryByText('Fallback loader')).not.toBeInTheDocument();
  });

  it('continues animations from the server-rendered loader timeline', () => {
    root.innerHTML = '<div class="splash-loader">Loading Sentry</div>';
    const sourceAnimation = {
      currentTime: 750,
      playbackRate: 1,
      startTime: 100,
    } as Animation;
    const clonedAnimation = {
      currentTime: 0,
      playbackRate: 0,
      startTime: 900,
    } as Animation;

    Object.defineProperty(Element.prototype, 'getAnimations', {
      configurable: true,
      value: jest.fn(function (this: Element) {
        return root.contains(this) ? [sourceAnimation] : [clonedAnimation];
      }),
    });

    render(<InitialLoadingIndicator />);

    expect(clonedAnimation.playbackRate).toBe(1);
    expect(clonedAnimation.startTime).toBe(100);
  });

  it('renders its fallback when the initial loader is no longer present', () => {
    render(<InitialLoadingIndicator fallback={<div>Fallback loader</div>} />);

    expect(screen.getByText('Fallback loader')).toBeInTheDocument();
  });
});
