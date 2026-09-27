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

  it('calls onExpandToggle and onDelete', async () => {
    const onExpandToggle = jest.fn();
    const onDelete = jest.fn();
    render(
      <PathMapping
        {...defaultProps}
        stackRoot="src/"
        sourceRoot="app/"
        branch="main"
        onExpandToggle={onExpandToggle}
        onDelete={onDelete}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: /expand path mapping/i}));
    expect(onExpandToggle).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', {name: /delete path mapping/i}));
    expect(onDelete).toHaveBeenCalledTimes(1);
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

  it('calls onChange when a field is modified', async () => {
    const onChange = jest.fn();
    render(
      <PathMapping
        {...defaultProps}
        editing
        isNew
        stackRoot="src/"
        sourceRoot="app/"
        branch="main"
        onChange={onChange}
      />
    );

    const branchInput = screen.getByRole('textbox', {name: /branch/i});
    await userEvent.clear(branchInput);
    await userEvent.type(branchInput, 'dev');

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({branch: 'dev'}));
  });

  it('normalizes trailing slash on blur', async () => {
    const onChange = jest.fn();
    render(
      <PathMapping
        {...defaultProps}
        editing
        isNew
        stackRoot=""
        sourceRoot=""
        branch="main"
        onChange={onChange}
      />
    );

    const stackInput = screen.getByRole('textbox', {name: /stack trace prefix/i});
    await userEvent.type(stackInput, 'src');
    await userEvent.tab();

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({stackRoot: 'src/'})
    );
  });

  it('converts invalid branch characters to dashes', async () => {
    const onChange = jest.fn();
    render(
      <PathMapping
        {...defaultProps}
        editing
        isNew
        stackRoot=""
        sourceRoot=""
        branch=""
        onChange={onChange}
      />
    );

    const branchInput = screen.getByRole('textbox', {name: /branch/i});
    await userEvent.type(branchInput, 'my branch');

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({branch: 'my-branch'})
    );
  });

  it('renders preview and updates it as stack root changes', async () => {
    render(
      <PathMapping
        {...defaultProps}
        editing
        isNew
        stackRoot=""
        sourceRoot=""
        branch="main"
      />
    );

    expect(screen.getByText('In your stack trace')).toBeInTheDocument();
    expect(screen.getByText('Sentry opens in your repo')).toBeInTheDocument();

    const stackInput = screen.getByRole('textbox', {name: /stack trace prefix/i});
    await userEvent.type(stackInput, 'src/');

    expect(screen.getAllByText('src/')).toHaveLength(2);
  });
});
