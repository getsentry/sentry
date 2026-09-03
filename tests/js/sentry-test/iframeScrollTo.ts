/**
 * jsdom does not implement `scrollTo`, and rrweb calls it on the replay
 * iframe's own window when it applies a snapshot's initial offset. jsdom
 * reports that as an error, which fails the test. Call this from a `beforeAll`
 * in specs that render a player over a replay with a full snapshot.
 */
export function stubIframeScrollTo() {
  const getContentWindow = Object.getOwnPropertyDescriptor(
    HTMLIFrameElement.prototype,
    'contentWindow'
  )!.get!;

  jest
    .spyOn(HTMLIFrameElement.prototype, 'contentWindow', 'get')
    .mockImplementation(function (this: HTMLIFrameElement): Window | null {
      const contentWindow: Window | null = getContentWindow.call(this);

      if (contentWindow) {
        contentWindow.scrollTo = jest.fn();
      }

      return contentWindow;
    });
}
