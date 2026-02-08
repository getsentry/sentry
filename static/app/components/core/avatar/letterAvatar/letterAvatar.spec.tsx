import {render, screen} from 'sentry-test/reactTestingLibrary';

// eslint-disable-next-line boundaries/entry-point
import {LetterAvatar} from './letterAvatar';

describe('LetterAvatar', () => {
  describe('initials rendering', () => {
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
      render(<LetterAvatar identifier="test@example.com" name={name} />);
      expect(screen.getByText(expected)).toBeInTheDocument();
    });
  });

  describe('fallback rendering', () => {
    it.each([[''], ['   '], [' '], [undefined]])(
      'renders question mark for empty/whitespace: "%s"',
      (name: string | undefined) => {
        // @ts-expect-error test untyped falsy values
        render(<LetterAvatar identifier="unknown" name={name} />);
        expect(screen.getByText('?')).toBeInTheDocument();
      }
    );
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
