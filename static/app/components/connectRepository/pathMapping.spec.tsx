import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {PathMapping} from 'sentry/components/connectRepository/pathMapping';

const defaultProps = {
  stackRoot: '',
  sourceRoot: '',
  branch: '',
  editing: false,
  isNew: false,
  onChange: jest.fn(),
  onDelete: jest.fn(),
  onExpandToggle: jest.fn(),
};

describe('PathMapping', () => {
  it('renders collapsed summary with paths and branch', () => {
    render(
      <PathMapping {...defaultProps} stackRoot="src/" sourceRoot="app/" branch="main" />
    );

    expect(screen.getByText('src/')).toBeInTheDocument();
    expect(screen.getByText('app/')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', {name: /stack trace prefix/i})
    ).not.toBeInTheDocument();
  });

  it('shows empty placeholder when paths are blank', () => {
    render(<PathMapping {...defaultProps} branch="main" />);

    expect(screen.getAllByText('empty')).toHaveLength(2);
  });

  it('hides the summary row for a new (never-saved) mapping', () => {
    render(
      <PathMapping
        {...defaultProps}
        editing
        isNew
        stackRoot="src/"
        sourceRoot="app/"
        branch="main"
      />
    );

    expect(screen.queryByRole('button', {name: /expand/i})).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: /branch/i})).toBeInTheDocument();
  });

  it('renders the edit form when expanded', () => {
    render(
      <PathMapping
        {...defaultProps}
        editing
        stackRoot="src/"
        sourceRoot="app/"
        branch="main"
      />
    );

    expect(screen.getByRole('textbox', {name: /branch/i})).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {name: /stack trace prefix/i})
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: /repository prefix/i})).toBeInTheDocument();
  });

  it('shows placeholders on the prefix inputs', () => {
    render(<PathMapping {...defaultProps} editing isNew />);

    expect(screen.getByRole('textbox', {name: /stack trace prefix/i})).toHaveAttribute(
      'placeholder',
      'e.g src/'
    );
    expect(screen.getByRole('textbox', {name: /repository prefix/i})).toHaveAttribute(
      'placeholder',
      'e.g src/app/'
    );
  });

  it('always shows the two-column preview headings, even when both prefixes are empty', () => {
    render(<PathMapping {...defaultProps} editing isNew />);

    expect(screen.getByText('Example preview')).toBeInTheDocument();
    expect(screen.getByText('In your stack trace')).toBeInTheDocument();
    expect(screen.getByText('Sentry opens in your repo')).toBeInTheDocument();
    // No accent highlights — just the bare suffix on each side
    expect(screen.getAllByText('views/index.tsx')).toHaveLength(2);
  });

  it('accents only the filled prefix once a value is typed', async () => {
    render(<PathMapping {...defaultProps} editing isNew />);

    await userEvent.type(
      screen.getByRole('textbox', {name: /stack trace prefix/i}),
      'lib/'
    );

    expect(screen.getByText('lib/')).toBeInTheDocument();
  });
});
