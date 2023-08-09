import {render, screen} from 'sentry-test/reactTestingLibrary';

import Carousel from 'sentry/components/carousel';
import Placeholder from 'sentry/components/placeholder';

describe('Carousel', function () {
  it('hides arrows if content does not overflow in x', function () {
    render(
      <Placeholder width="200px" height="100px">
        <Carousel>
          <Placeholder width="50px" height="50px" />
        </Carousel>
      </Placeholder>
    );

    expect(screen.queryByLabelText('Scroll left')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Scroll right')).not.toBeInTheDocument();
  });

  it('does not show left arrow if all the way to the left', function () {
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: 100,
    });

    render(
      <Carousel>
        <Placeholder />
        <Placeholder />
        <Placeholder />
      </Carousel>
    );

    expect(screen.queryByLabelText('Scroll left')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Scroll right')).toBeInTheDocument();
  });

  it('does not show right arrow if all the way to the right', async function () {
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
      configurable: true,
      value: 100,
    });
    render(
      <Carousel>
        <Placeholder />
        <Placeholder />
        <Placeholder />
      </Carousel>
    );

    expect(await screen.findByLabelText('Scroll left')).toBeInTheDocument();
    expect(screen.queryByLabelText('Scroll right')).not.toBeInTheDocument();
  });
});
