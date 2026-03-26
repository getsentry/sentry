// test: verifying changedSince
import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

// eslint-disable-next-line boundaries/entry-point
import {Avatar} from './avatar';

/**
 * Tests for useAvatar() hook behavior, exercised through the Avatar component.
 * Unit tests for getInitials() and getColor() utilities live alongside useAvatar.tsx.
 */
describe('useAvatar', () => {
  describe('initials computation', () => {
    it.each([
      ['jane bloggs', 'JB'],
      ['jane', 'J'],
      ['jane austen bloggs', 'JB'],
      ['johnsmith@example.com', 'J'],
      ['X', 'X'],
      [' Jane Bloggs ', 'JB'],
      ['☃super ☃duper', '☃☃'],
      ['123', '1'],
      ['127.0.0.1', '1'],
    ])('renders %s as %s', (name, expected) => {
      render(<Avatar type="letter_avatar" identifier="test@example.com" name={name} />);
      expect(screen.getByText(expected)).toBeInTheDocument();
    });
  });

  describe('initials fallback', () => {
    it.each([[''], ['   '], [' '], [undefined]])(
      'renders question mark for empty/whitespace: "%s"',
      (name: string | undefined) => {
        render(
          // @ts-expect-error test untyped falsy values
          <Avatar type="letter_avatar" identifier="unknown" name={name} />
        );
        expect(screen.getByText('?')).toBeInTheDocument();
      }
    );

    it('renders question mark for data-scrubbed [Filtered] name', () => {
      render(
        <Avatar type="letter_avatar" identifier="user@example.com" name="[Filtered]" />
      );
      expect(screen.getByText('?')).toBeInTheDocument();
    });
  });

  describe('identifier vs name', () => {
    it('uses name for initials, not identifier', () => {
      const {rerender} = render(
        <Avatar type="letter_avatar" identifier="jane.doe@example.com" name="Jane Doe" />
      );
      expect(screen.getByText('JD')).toBeInTheDocument();

      rerender(
        <Avatar
          type="letter_avatar"
          identifier="jane.smith@example.com"
          name="Jane Doe"
        />
      );
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('updates initials when name changes with same identifier', () => {
      const {rerender} = render(
        <Avatar type="letter_avatar" identifier="user@example.com" name="Jane Doe" />
      );
      expect(screen.getByText('JD')).toBeInTheDocument();

      rerender(
        <Avatar type="letter_avatar" identifier="user@example.com" name="Jane Smith" />
      );
      expect(screen.getByText('JS')).toBeInTheDocument();
    });
  });

  describe('image loading', () => {
    it('renders image when src is provided', () => {
      render(
        <Avatar
          type="upload"
          uploadUrl="https://example.com/avatar.jpg"
          identifier="jane.bloggs@example.com"
          name="Jane Bloggs"
        />
      );
      const img = screen.getByRole('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg?s=120');
    });

    it('falls back to letter avatar when image fails to load', async () => {
      render(
        <Avatar
          type="upload"
          uploadUrl="https://example.com/broken.jpg"
          identifier="jane.bloggs@example.com"
          name="Jane Bloggs"
        />
      );

      const img = screen.getByRole('img');
      act(() => {
        img.dispatchEvent(new Event('error'));
      });

      await waitFor(() => {
        expect(screen.getByText('JB')).toBeInTheDocument();
      });
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('hashes the gravatarId and renders the gravatar image', async () => {
      render(
        <Avatar
          type="gravatar"
          gravatarId="example@example.com"
          identifier="example@example.com"
          name="John Doe"
        />
      );

      expect(await screen.findByRole('img')).toHaveAttribute(
        'src',
        'https://gravatar.com/avatar/31c5543c1734d25c7206f5fd591525d0295bec6fe84ff82f946a34fe970a1e66?d=404&s=120'
      );
    });

    it('falls back to letter avatar when gravatarId is empty', () => {
      render(<Avatar type="gravatar" gravatarId="" identifier="" name="John Doe" />);

      expect(screen.getByText('JD')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });
});
