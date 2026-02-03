import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

// eslint-disable-next-line boundaries/entry-point
import {ImageAvatar} from './imageAvatar';

describe('ImageAvatar', () => {
  describe('successful image loading', () => {
    it('renders image when src is provided', () => {
      render(
        <ImageAvatar
          src="https://example.com/avatar.jpg"
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
          src="https://example.com/avatar.jpg"
          identifier="jane.bloggs@example.com"
          name="Jane Bloggs"
        />
      );
      expect(screen.getByAltText('Jane Bloggs')).toBeInTheDocument();
    });
  });

  describe('fallback to LetterAvatar', () => {
    it('renders LetterAvatar when src is not provided', () => {
      render(
        <ImageAvatar src="" identifier="jane.bloggs@example.com" name="Jane Bloggs" />
      );
      expect(screen.getByText('JB')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('renders LetterAvatar when src is undefined', () => {
      render(
        <ImageAvatar src="" identifier="jane.bloggs@example.com" name="Jane Bloggs" />
      );
      expect(screen.getByText('JB')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('renders LetterAvatar when image fails to load', async () => {
      render(
        <ImageAvatar
          src="https://example.com/broken.jpg"
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

    it('passes props to LetterAvatar fallback', () => {
      render(
        <ImageAvatar src="" identifier="john.smith@example.com" name="John Smith" />
      );
      expect(screen.getByText('JS')).toBeInTheDocument();
    });
  });

  describe('src changes', () => {
    it('attempts to load new image when src changes', async () => {
      const {rerender} = render(
        <ImageAvatar
          src="https://example.com/broken.jpg"
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
          src="https://example.com/new-avatar.jpg"
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
          src="https://example.com/broken1.jpg"
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
          src="https://example.com/broken2.jpg"
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
