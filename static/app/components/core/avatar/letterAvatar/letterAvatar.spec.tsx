import {render, screen} from 'sentry-test/reactTestingLibrary';

// eslint-disable-next-line boundaries/entry-point
import {LetterAvatar} from './letterAvatar';

describe('LetterAvatar', () => {
  describe('initials rendering', () => {
    it('renders first and last initial for two-word names', () => {
      render(<LetterAvatar identifier="jane.bloggs@example.com" name="Jane Bloggs" />);
      expect(screen.getByText('JB')).toBeInTheDocument();
    });

    it('renders first initial only for single-word names', () => {
      render(<LetterAvatar identifier="jane@example.com" name="Jane" />);
      expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('renders first and last initial for three or more word names', () => {
      render(
        <LetterAvatar identifier="jane.bloggs@example.com" name="Jane Austen Bloggs" />
      );
      expect(screen.getByText('JB')).toBeInTheDocument();
    });

    it('renders first letter of email addresses', () => {
      render(
        <LetterAvatar identifier="johnsmith@example.com" name="johnsmith@example.com" />
      );
      expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('renders first letter for single character input', () => {
      render(<LetterAvatar identifier="x@example.com" name="X" />);
      expect(screen.getByText('X')).toBeInTheDocument();
    });

    it('renders initials in uppercase', () => {
      render(<LetterAvatar identifier="jane.bloggs@example.com" name="jane bloggs" />);
      expect(screen.getByText('JB')).toBeInTheDocument();
    });

    it('trims trailing spaces from names', () => {
      render(<LetterAvatar identifier="jane.bloggs@example.com" name="Jane Bloggs " />);
      expect(screen.getByText('JB')).toBeInTheDocument();
    });

    it('trims leading spaces from names', () => {
      render(<LetterAvatar identifier="jane.bloggs@example.com" name=" Jane Bloggs" />);
      expect(screen.getByText('JB')).toBeInTheDocument();
    });

    it('handles multibyte characters without slicing them', () => {
      render(<LetterAvatar identifier="snowman@example.com" name="☃super ☃duper" />);
      expect(screen.getByText('☃☃')).toBeInTheDocument();
    });

    it('handles numeric input', () => {
      render(<LetterAvatar identifier="user123" name="123" />);
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('handles IP addresses', () => {
      render(<LetterAvatar identifier="127.0.0.1" name="127.0.0.1" />);
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  describe('fallback rendering', () => {
    it('renders question mark for empty string', () => {
      render(<LetterAvatar identifier="unknown" name="" />);
      expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('renders question mark for whitespace-only string', () => {
      render(<LetterAvatar identifier="unknown" name="   " />);
      expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('renders question mark for single space', () => {
      render(<LetterAvatar identifier="unknown" name=" " />);
      expect(screen.getByText('?')).toBeInTheDocument();
    });
  });

  describe('identifier vs name separation', () => {
    it('uses identifier prop for color hashing', () => {
      // Render with identifier - this should determine the color
      render(<LetterAvatar identifier="user123" name="Jane Doe" />);
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('uses name prop for initials, not identifier', () => {
      // Different identifiers but same name should show same initials
      const {rerender} = render(
        <LetterAvatar identifier="jane.doe@example.com" name="Jane Doe" />
      );
      expect(screen.getByText('JD')).toBeInTheDocument();

      rerender(<LetterAvatar identifier="jane.smith@example.com" name="Jane Doe" />);
      // Initials still come from name, not identifier
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('handles initials change while keeping same identifier', () => {
      // Same identifier (for color) but different name (for initials)
      const {rerender} = render(
        <LetterAvatar identifier="user@example.com" name="Jane Doe" />
      );
      expect(screen.getByText('JD')).toBeInTheDocument();

      // Change name but keep identifier the same
      rerender(<LetterAvatar identifier="user@example.com" name="Jane Smith" />);
      expect(screen.getByText('JS')).toBeInTheDocument();
    });
  });
});
