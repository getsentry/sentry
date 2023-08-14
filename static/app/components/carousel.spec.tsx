import {render, screen} from 'sentry-test/reactTestingLibrary';

import Carousel from 'sentry/components/carousel';
import Placeholder from 'sentry/components/placeholder';

export function setIntersectionObserver(
  entries: {isIntersecting: boolean; target: {id: string}}[]
) {
  (() => {
    return (global.IntersectionObserver = class IntersectionObserver {
      [x: string]: any;
      constructor(cb: any) {
        this.cb = cb;
      }
      observe() {
        this.cb(entries);
      }
      unobserve() {}
      disconnect() {}
    } as any);
  })();
}

describe('Carousel', function () {
  beforeEach(() => {});
  it('hides arrows if content does not overflow in x', function () {
    setIntersectionObserver([
      {target: {id: 'left-anchor'}, isIntersecting: true},
      {target: {id: 'right-anchor'}, isIntersecting: true},
    ]);

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
    setIntersectionObserver([
      {target: {id: 'left-anchor'}, isIntersecting: true},
      {target: {id: 'right-anchor'}, isIntersecting: false},
    ]);

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
    setIntersectionObserver([
      {target: {id: 'left-anchor'}, isIntersecting: false},
      {target: {id: 'right-anchor'}, isIntersecting: true},
    ]);

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
