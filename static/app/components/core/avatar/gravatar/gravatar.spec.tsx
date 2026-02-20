import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

// eslint-disable-next-line boundaries/entry-point
import {Gravatar} from './gravatar';

describe('Gravatar', () => {
  describe('successful gravatar loading', () => {
    it('hashes the provided gravatarId and renders image', async () => {
      render(<Gravatar gravatarId="example@example.com" name="John Doe" />);

      expect(await screen.findByRole('img')).toHaveAttribute(
        'src',
        'https://gravatar.com/avatar/31c5543c1734d25c7206f5fd591525d0295bec6fe84ff82f946a34fe970a1e66?d=404&s=120'
      );
    });

    it('includes default remote size parameter in URL', async () => {
      render(<Gravatar gravatarId="example@example.com" name="John Doe" />);

      expect(await screen.findByRole('img')).toHaveAttribute(
        'src',
        expect.stringContaining('s=120')
      );
    });

    it('includes d=404 parameter to trigger error on missing gravatars', async () => {
      render(<Gravatar gravatarId="example@example.com" name="John Doe" />);

      expect(await screen.findByRole('img')).toHaveAttribute(
        'src',
        expect.stringContaining('d=404')
      );
    });

    it('passes name as alt attribute to image', async () => {
      render(<Gravatar gravatarId="example@example.com" name="John Doe" />);

      expect(await screen.findByAltText('John Doe')).toBeInTheDocument();
    });
  });

  describe('fallback to LetterAvatar', () => {
    it.each([
      ['', 'John Doe', 'JD'],
      ['   ', 'John Doe', 'JD'],
      ['', 'Alice Bob', 'AB'],
    ])(
      'renders LetterAvatar with initials %s when gravatarId is "%s" and name is "%s"',
      (gravatarId, name, expected) => {
        render(<Gravatar gravatarId={gravatarId} name={name} />);

        expect(screen.getByText(expected)).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
      }
    );
  });

  describe('hash updates', () => {
    it('generates new hash when gravatarId changes', async () => {
      const {rerender} = render(
        <Gravatar gravatarId="user1@example.com" name="User One" />
      );

      const img1 = await screen.findByRole('img');
      const src1 = img1.getAttribute('src');

      // Change gravatarId
      rerender(<Gravatar gravatarId="user2@example.com" name="User Two" />);

      await waitFor(() => {
        const img2 = screen.getByRole('img');
        const src2 = img2.getAttribute('src');
        expect(src2).not.toBe(src1);
      });
    });

    it('shows fallback when changing from valid to empty gravatarId', async () => {
      const {rerender} = render(
        <Gravatar gravatarId="user@example.com" name="John Doe" />
      );

      expect(await screen.findByRole('img')).toBeInTheDocument();

      // Change to empty gravatarId
      rerender(<Gravatar gravatarId="" name="John Doe" />);

      expect(screen.getByText('JD')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });
});
