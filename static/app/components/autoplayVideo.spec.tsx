import * as React from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AutoplayVideo} from 'sentry/components/autoplayVideo';

jest.mock('react', () => {
  return {
    ...jest.requireActual('react'),
    useRef: jest.fn(),
  };
});

// Use a proxy to prevent <video ref={ref}/> from overriding our ref.current
const makeProxyMock = (video: Partial<HTMLVideoElement>) => {
  return new Proxy(
    {current: video},
    {
      get(obj, prop) {
        return obj[prop];
      },
      set(obj, prop) {
        if (prop === 'current') {
          obj.current = obj.current;
        }
        return true;
      },
    }
  );
};

describe('autoplayVideo', () => {
  it('sets mute and calls play', () => {
    const mock = makeProxyMock({
      muted: false,
      play: jest.fn().mockReturnValue(Promise.resolve()),
    });

    // @ts-ignore we are mocking useRef
    React.useRef.mockImplementation(() => mock);

    render(<AutoplayVideo aria-label="video" src="https://example.com/video.mp4" />);

    expect(screen.getByLabelText('video')).toBeInTheDocument();
    expect(mock.current.muted).toBe(true);
    expect(mock.current.play).toHaveBeenCalledTimes(1);
  });

  it('handles non promise-like return from play', () => {
    const mock = makeProxyMock({
      muted: false,
      play: jest.fn().mockReturnValue(null),
    });

    // @ts-ignore we are mocking useRef
    React.useRef.mockImplementation(() => mock);

    render(<AutoplayVideo aria-label="video" src="https://example.com/video.mp4" />);

    expect(screen.getByLabelText('video')).toBeInTheDocument();
    expect(mock.current.muted).toBe(true);

    // Seems that useEffect runs, so no mocking or tick is needed.
    // Was tested manually by removing the ?.catch safe access and the test fails
    expect(mock.current.play).toHaveBeenCalledTimes(1);
  });
});
