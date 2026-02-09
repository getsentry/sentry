import {SentryAppFixture} from 'sentry-fixture/sentryApp';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {SentryApp} from 'sentry/types/integrations';

// eslint-disable-next-line boundaries/entry-point
import {SentryAppAvatar} from './sentryAppAvatar';

describe('SentryAppAvatar', () => {
  describe('isColor prop filtering', () => {
    it('selects color avatar when isColor=true', () => {
      const sentryApp: SentryApp = SentryAppFixture({
        avatars: [
          {
            avatarType: 'upload',
            avatarUrl: 'https://example.com/color-logo.png',
            avatarUuid: 'color-123',
            color: true,
            photoType: 'logo',
          },
          {
            avatarType: 'upload',
            avatarUrl: 'https://example.com/non-color-icon.png',
            avatarUuid: 'non-color-456',
            color: false,
            photoType: 'icon',
          },
        ],
      });

      render(<SentryAppAvatar sentryApp={sentryApp} isColor />);
      const img = screen.getByRole('img');
      // Should include the size parameter
      expect(img).toHaveAttribute('src', 'https://example.com/color-logo.png?s=120');
    });

    it('selects non-color avatar when isColor=false', () => {
      const sentryApp: SentryApp = SentryAppFixture({
        avatars: [
          {
            avatarType: 'upload',
            avatarUrl: 'https://example.com/color-logo.png',
            avatarUuid: 'color-123',
            color: true,
            photoType: 'logo',
          },
          {
            avatarType: 'upload',
            avatarUrl: 'https://example.com/non-color-icon.png',
            avatarUuid: 'non-color-456',
            color: false,
            photoType: 'icon',
          },
        ],
      });

      render(<SentryAppAvatar sentryApp={sentryApp} isColor={false} />);
      const img = screen.getByRole('img');
      // Should include the size parameter
      expect(img).toHaveAttribute('src', 'https://example.com/non-color-icon.png?s=120');
    });

    it('shows fallback when requested color variant does not exist', () => {
      const sentryApp: SentryApp = SentryAppFixture({
        avatars: [
          {
            avatarType: 'upload',
            avatarUrl: 'https://example.com/color-logo.png',
            avatarUuid: 'color-123',
            color: true,
            photoType: 'logo',
          },
        ],
      });

      // Request non-color version when only color version exists
      render(<SentryAppAvatar sentryApp={sentryApp} isColor={false} />);
      expect(screen.getByTestId('default-sentry-app-avatar')).toBeInTheDocument();
      // Should not have an img element (the fallback is an SVG icon)
      const images = screen.queryAllByRole('img');
      // The SVG icon has role="img", but shouldn't have src attribute
      images.forEach(img => {
        expect(img).not.toHaveAttribute('src');
      });
    });

    it('shows fallback when isDefault=true regardless of avatars', () => {
      const sentryApp: SentryApp = SentryAppFixture({
        avatars: [
          {
            avatarType: 'upload',
            avatarUrl: 'https://example.com/color-logo.png',
            avatarUuid: 'color-123',
            color: true,
            photoType: 'logo',
          },
        ],
      });

      render(<SentryAppAvatar sentryApp={sentryApp} isDefault />);
      expect(screen.getByTestId('default-sentry-app-avatar')).toBeInTheDocument();
      // Should not have an img element with src (the fallback is an SVG icon)
      const images = screen.queryAllByRole('img');
      images.forEach(img => {
        expect(img).not.toHaveAttribute('src');
      });
    });

    it('shows fallback when avatar type is default', () => {
      const sentryApp: SentryApp = SentryAppFixture({
        avatars: [
          {
            avatarType: 'default',
            avatarUrl: '',
            avatarUuid: null,
            color: true,
            photoType: 'logo',
          },
        ],
      });

      render(<SentryAppAvatar sentryApp={sentryApp} isColor />);
      expect(screen.getByTestId('default-sentry-app-avatar')).toBeInTheDocument();
      // Should not have an img element with src (the fallback is an SVG icon)
      const images = screen.queryAllByRole('img');
      images.forEach(img => {
        expect(img).not.toHaveAttribute('src');
      });
    });
  });
});
