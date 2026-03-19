// test: verifying changedSince
import type {Tagged} from 'type-fest';

import {render, screen} from 'sentry-test/reactTestingLibrary';

// eslint-disable-next-line boundaries/entry-point
import {ImageAvatar} from './imageAvatar';

describe('ImageAvatar', () => {
  it('renders image with the provided src and alt', () => {
    render(
      <ImageAvatar
        configuration={{
          src: 'https://example.com/avatar.jpg' as Tagged<string, '__avatar'>,
          alt: 'Jane Bloggs' as Tagged<string, '__avatar'>,
          ref: () => undefined,
        }}
      />
    );
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    expect(img).toHaveAttribute('alt', 'Jane Bloggs');
  });
});
