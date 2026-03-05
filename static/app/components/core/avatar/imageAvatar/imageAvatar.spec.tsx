import {render, screen} from 'sentry-test/reactTestingLibrary';

// eslint-disable-next-line boundaries/entry-point
import {ImageAvatar} from './imageAvatar';

describe('ImageAvatar', () => {
  it('renders image with the provided src and alt', () => {
    render(
      <ImageAvatar
        configuration={{
          src: 'https://example.com/avatar.jpg' as string & {__avatar: boolean},
          alt: 'Jane Bloggs' as string & {__avatar: boolean},
          ref: () => undefined,
        }}
      />
    );
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    expect(img).toHaveAttribute('alt', 'Jane Bloggs');
  });
});
