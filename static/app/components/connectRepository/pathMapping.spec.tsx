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
      'src/'
    );
    expect(screen.getByRole('textbox', {name: /repository prefix/i})).toHaveAttribute(
      'placeholder',
      'src/app'
    );
  });

  describe('warning prop', () => {
    it('shows a warning icon on the collapsed summary for an overlap warning', () => {
      render(
        <PathMapping
          {...defaultProps}
          stackRoot="src/"
          sourceRoot="src/app/"
          branch="main"
          warning={{type: 'overlap', stackRoot: 'src/app/', sourceRoot: 'dist/'}}
        />
      );

      expect(screen.getByRole('img', {name: 'Warning'})).toBeInTheDocument();
    });

    it('does not show a warning icon for a catch-all warning on the collapsed row', () => {
      render(
        <PathMapping {...defaultProps} branch="main" warning={{type: 'catchAll'}} />
      );

      expect(screen.queryByRole('img', {name: 'Warning'})).not.toBeInTheDocument();
    });

    it('shows the overlap alert when editing', () => {
      render(
        <PathMapping
          {...defaultProps}
          stackRoot="src/"
          sourceRoot="src/app/"
          branch="main"
          editing
          warning={{type: 'overlap', stackRoot: 'src/app/', sourceRoot: 'dist/'}}
        />
      );

      expect(screen.getByText(/Only the first match applies/)).toBeInTheDocument();
    });

    it('does not show the overlap alert when collapsed', () => {
      render(
        <PathMapping
          {...defaultProps}
          stackRoot="src/"
          sourceRoot="src/app/"
          branch="main"
          warning={{type: 'overlap', stackRoot: 'src/app/', sourceRoot: 'dist/'}}
        />
      );

      expect(screen.queryByText(/Only the first match applies/)).not.toBeInTheDocument();
    });

    it('shows the catch-all alert when editing', () => {
      render(
        <PathMapping
          {...defaultProps}
          branch="main"
          editing
          isNew
          warning={{type: 'catchAll'}}
        />
      );

      expect(
        screen.getByText(/this rule needs a specific path to match/)
      ).toBeInTheDocument();
    });
  });

  it('renders preview using placeholder example and updates on input', async () => {
    render(<PathMapping {...defaultProps} editing isNew />);

    expect(screen.getByText('In your stack trace')).toBeInTheDocument();
    expect(screen.getByText('Sentry opens in your repo')).toBeInTheDocument();

    // Preview shows placeholder values while inputs are empty
    expect(screen.getByText('src/')).toBeInTheDocument();
    expect(screen.getByText('src/app/')).toBeInTheDocument();

    // Typing updates the stack root in the preview
    await userEvent.type(
      screen.getByRole('textbox', {name: /stack trace prefix/i}),
      'lib/'
    );
    expect(screen.getByText('lib/')).toBeInTheDocument();
  });
});
