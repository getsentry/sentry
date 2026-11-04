import {scrollIntoViewBelowTopBar} from 'sentry/utils/scrollIntoViewBelowTopBar';

describe('scrollIntoViewBelowTopBar', () => {
  const scrollIntoView = jest.fn();

  beforeEach(() => {
    scrollIntoView.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  it('offsets the scroll by only the top bar when no extra offset is provided', () => {
    const element = document.createElement('div');

    scrollIntoViewBelowTopBar(element);

    expect(element).toHaveStyle({
      scrollMarginTop: 'calc(var(--top-bar-height, 0px) + 0px)',
    });
    expect(scrollIntoView).toHaveBeenCalledWith({behavior: 'smooth', block: 'start'});
  });

  it('adds the extra offset below the top bar when one is provided', () => {
    const element = document.createElement('div');

    scrollIntoViewBelowTopBar(element, 48);

    expect(element).toHaveStyle({
      scrollMarginTop: 'calc(var(--top-bar-height, 0px) + 48px)',
    });
    expect(scrollIntoView.mock.contexts[0]).toBe(element);
  });
});
