import {render, screen} from 'sentry-test/reactTestingLibrary';

// eslint-disable-next-line boundaries/entry-point
import {Avatar} from './avatar';

describe('Avatar', () => {
  describe('upload URL size parameter', () => {
    it('appends ?s=120 to upload URLs', () => {
      render(
        <Avatar
          type="upload"
          uploadUrl="https://example.com/avatar.jpg"
          identifier="test-id"
          name="Test User"
        />
      );
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg?s=120');
    });

    it('appends &s=120 to upload URLs with existing query params', () => {
      render(
        <Avatar
          type="upload"
          uploadUrl="https://example.com/avatar.jpg?version=2"
          identifier="test-id"
          name="Test User"
        />
      );
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute(
        'src',
        'https://example.com/avatar.jpg?version=2&s=120'
      );
    });

    it('does not modify data URLs', () => {
      const dataUrl =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      render(
        <Avatar type="upload" uploadUrl={dataUrl} identifier="test-id" name="Test User" />
      );
      const img = screen.getByRole('img');
      // Data URLs should not have size parameter appended
      expect(img).toHaveAttribute('src', dataUrl);
    });
  });

  describe('avatar type rendering', () => {
    it('renders ImageAvatar for upload type', () => {
      render(
        <Avatar
          type="upload"
          uploadUrl="https://example.com/avatar.jpg"
          identifier="test-id"
          name="Test User"
        />
      );
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('renders LetterAvatar for letter_avatar type', () => {
      render(<Avatar type="letter_avatar" identifier="test-id" name="Test User" />);
      expect(screen.getByText('TU')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('renders Gravatar for gravatar type', async () => {
      render(
        <Avatar
          type="gravatar"
          gravatarId="test@example.com"
          identifier="test-id"
          name="Test User"
        />
      );
      // Gravatar hashes asynchronously, so use findBy
      expect(await screen.findByRole('img')).toBeInTheDocument();
    });
  });

  describe('tooltip', () => {
    it('shows tooltip when hasTooltip=true', () => {
      render(
        <Avatar
          type="letter_avatar"
          identifier="test-id"
          name="Test User"
          tooltip="Test Tooltip"
          hasTooltip
        />
      );
      expect(screen.getByText('TU')).toBeInTheDocument();
    });

    it('does not show tooltip when hasTooltip=false', () => {
      render(
        <Avatar
          type="letter_avatar"
          identifier="test-id"
          name="Test User"
          tooltip="Test Tooltip"
          hasTooltip={false}
        />
      );
      expect(screen.getByText('TU')).toBeInTheDocument();
    });
  });
});
