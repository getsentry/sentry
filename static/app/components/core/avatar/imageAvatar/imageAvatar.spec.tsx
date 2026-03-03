import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

// eslint-disable-next-line boundaries/entry-point
import {ImageAvatar} from './imageAvatar';

describe('ImageAvatar', () => {
  describe('image definition', () => {
    describe('successful image loading', () => {
      it('renders image when src is provided', () => {
        render(
          <ImageAvatar
            definition={{type: 'image', src: 'https://example.com/avatar.jpg'}}
            identifier="jane.bloggs@example.com"
            name="Jane Bloggs"
          />
        );
        const img = screen.getByRole('img');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
      });

      it('uses name as alt attribute for image', () => {
        render(
          <ImageAvatar
            definition={{type: 'image', src: 'https://example.com/avatar.jpg'}}
            identifier="jane.bloggs@example.com"
            name="Jane Bloggs"
          />
        );
        expect(screen.getByAltText('Jane Bloggs')).toBeInTheDocument();
      });
    });

    describe('fallback to LetterAvatar', () => {
      it.each([
        ['', 'jane.bloggs@example.com', 'Jane Bloggs', 'JB'],
        ['', 'john.smith@example.com', 'John Smith', 'JS'],
      ])('renders LetterAvatar when src is "%s"', (src, identifier, name, expected) => {
        render(
          <ImageAvatar
            definition={{type: 'image', src}}
            identifier={identifier}
            name={name}
          />
        );
        expect(screen.getByText(expected)).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
      });

      it('renders LetterAvatar when image fails to load', async () => {
        render(
          <ImageAvatar
            definition={{type: 'image', src: 'https://example.com/broken.jpg'}}
            identifier="jane.bloggs@example.com"
            name="Jane Bloggs"
          />
        );

        const img = screen.getByRole('img');
        expect(img).toBeInTheDocument();

        // Simulate image load error
        act(() => {
          img.dispatchEvent(new Event('error'));
        });

        // After error, should show LetterAvatar
        await waitFor(() => {
          expect(screen.getByText('JB')).toBeInTheDocument();
        });
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
      });
    });

    describe('src changes', () => {
      it('attempts to load new image when src changes', async () => {
        const {rerender} = render(
          <ImageAvatar
            definition={{type: 'image', src: 'https://example.com/broken.jpg'}}
            identifier="jane.bloggs@example.com"
            name="Jane Bloggs"
          />
        );

        // Simulate image load error
        const img = screen.getByRole('img');
        act(() => {
          img.dispatchEvent(new Event('error'));
        });

        // Should show fallback
        await waitFor(() => {
          expect(screen.getByText('JB')).toBeInTheDocument();
        });
        expect(screen.queryByRole('img')).not.toBeInTheDocument();

        // Change src
        rerender(
          <ImageAvatar
            definition={{type: 'image', src: 'https://example.com/new-avatar.jpg'}}
            identifier="jane.bloggs@example.com"
            name="Jane Bloggs"
          />
        );

        // Should attempt to load new image
        await waitFor(() => {
          expect(screen.getByRole('img')).toHaveAttribute(
            'src',
            'https://example.com/new-avatar.jpg'
          );
        });
      });

      it('shows fallback again if new image also fails', async () => {
        const {rerender} = render(
          <ImageAvatar
            definition={{type: 'image', src: 'https://example.com/broken1.jpg'}}
            identifier="jane.bloggs@example.com"
            name="Jane Bloggs"
          />
        );

        // First image fails
        const img1 = screen.getByRole('img');
        act(() => {
          img1.dispatchEvent(new Event('error'));
        });
        await waitFor(() => {
          expect(screen.getByText('JB')).toBeInTheDocument();
        });

        // Try new image
        rerender(
          <ImageAvatar
            definition={{type: 'image', src: 'https://example.com/broken2.jpg'}}
            identifier="jane.bloggs@example.com"
            name="Jane Bloggs"
          />
        );

        // New image also fails
        await waitFor(() => {
          const img2 = screen.getByRole('img');
          act(() => {
            img2.dispatchEvent(new Event('error'));
          });
        });

        // Should still show fallback
        await waitFor(() => {
          expect(screen.getByText('JB')).toBeInTheDocument();
        });
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
      });
    });
  });

  describe('gravatar definition', () => {
    describe('successful gravatar loading', () => {
      it('hashes the provided gravatarId and renders image', async () => {
        render(
          <ImageAvatar
            definition={{type: 'gravatar', gravatarId: 'example@example.com'}}
            identifier="example@example.com"
            name="John Doe"
          />
        );

        expect(await screen.findByRole('img')).toHaveAttribute(
          'src',
          'https://gravatar.com/avatar/31c5543c1734d25c7206f5fd591525d0295bec6fe84ff82f946a34fe970a1e66?d=404&s=120'
        );
      });

      it('includes default remote size parameter in URL', async () => {
        render(
          <ImageAvatar
            definition={{type: 'gravatar', gravatarId: 'example@example.com'}}
            identifier="example@example.com"
            name="John Doe"
          />
        );

        expect(await screen.findByRole('img')).toHaveAttribute(
          'src',
          expect.stringContaining('s=120')
        );
      });

      it('includes d=404 parameter to trigger error on missing gravatars', async () => {
        render(
          <ImageAvatar
            definition={{type: 'gravatar', gravatarId: 'example@example.com'}}
            identifier="example@example.com"
            name="John Doe"
          />
        );

        expect(await screen.findByRole('img')).toHaveAttribute(
          'src',
          expect.stringContaining('d=404')
        );
      });

      it('passes name as alt attribute to image', async () => {
        render(
          <ImageAvatar
            definition={{type: 'gravatar', gravatarId: 'example@example.com'}}
            identifier="example@example.com"
            name="John Doe"
          />
        );

        expect(await screen.findByAltText('John Doe')).toBeInTheDocument();
      });
    });

    describe('fallback to LetterAvatar', () => {
      it.each([
        ['', 'John Doe', 'JD'],
        ['   ', 'John Doe', 'JD'],
        ['', 'Alice Bob', 'AB'],
      ])(
        'renders LetterAvatar when gravatarId is "%s" and name is "%s"',
        (gravatarId, name, expected) => {
          render(
            <ImageAvatar
              definition={{type: 'gravatar', gravatarId}}
              identifier={gravatarId}
              name={name}
            />
          );

          expect(screen.getByText(expected)).toBeInTheDocument();
          expect(screen.queryByRole('img')).not.toBeInTheDocument();
        }
      );
    });

    describe('hash updates', () => {
      it('generates new hash when gravatarId changes', async () => {
        const {rerender} = render(
          <ImageAvatar
            definition={{type: 'gravatar', gravatarId: 'user1@example.com'}}
            identifier="user1@example.com"
            name="User One"
          />
        );

        const img1 = await screen.findByRole('img');
        const src1 = img1.getAttribute('src');

        rerender(
          <ImageAvatar
            definition={{type: 'gravatar', gravatarId: 'user2@example.com'}}
            identifier="user2@example.com"
            name="User Two"
          />
        );

        await waitFor(() => {
          const img2 = screen.getByRole('img');
          const src2 = img2.getAttribute('src');
          expect(src2).not.toBe(src1);
        });
      });

      it('shows fallback when changing from valid to empty gravatarId', async () => {
        const {rerender} = render(
          <ImageAvatar
            definition={{type: 'gravatar', gravatarId: 'user@example.com'}}
            identifier="user@example.com"
            name="John Doe"
          />
        );

        expect(await screen.findByRole('img')).toBeInTheDocument();

        rerender(
          <ImageAvatar
            definition={{type: 'gravatar', gravatarId: ''}}
            identifier=""
            name="John Doe"
          />
        );

        expect(screen.getByText('JD')).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
      });
    });
  });
});
