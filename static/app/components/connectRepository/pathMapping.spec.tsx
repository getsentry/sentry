import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ScrapsForm} from '@sentry/scraps/form';

import {PathMapping} from 'sentry/components/connectRepository/pathMapping';
import type {PathMappingValue} from 'sentry/components/connectRepository/type';

import {useConnectRepoForm} from './useConnectRepoForm';

function TestMapping({
  value = {stackRoot: '', sourceRoot: '', branch: ''},
  editing = false,
  isNew = false,
  projectSlug,
}: {
  editing?: boolean;
  isNew?: boolean;
  projectSlug?: string;
  value?: PathMappingValue;
} = {}) {
  const form = useConnectRepoForm({
    defaultValues: {repository: null as string | null, pathMappings: [value]},
    onSubmit: () => {},
  });
  return (
    <ScrapsForm form={form}>
      <PathMapping
        editing={editing}
        fields="pathMappings[0]"
        form={form}
        isNew={isNew}
        value={value}
        onDelete={jest.fn()}
        onExpandToggle={jest.fn()}
        projectSlug={projectSlug}
      />
    </ScrapsForm>
  );
}

describe('PathMapping', () => {
  it('renders collapsed summary with paths and branch', () => {
    render(
      <TestMapping
        {...{value: {stackRoot: 'src/', sourceRoot: 'app/', branch: 'main'}}}
      />
    );

    expect(screen.getByText('src/')).toBeInTheDocument();
    expect(screen.getByText('app/')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', {name: /stack trace prefix/i})
    ).not.toBeInTheDocument();
  });

  it('shows empty placeholder when paths are blank', () => {
    render(<TestMapping {...{value: {stackRoot: '', sourceRoot: '', branch: 'main'}}} />);

    expect(screen.getAllByText('empty')).toHaveLength(2);
  });

  it('hides the summary row for a new (never-saved) mapping', () => {
    render(
      <TestMapping
        {...{
          editing: true,
          isNew: true,
          value: {stackRoot: 'src/', sourceRoot: 'app/', branch: 'main'},
        }}
      />
    );

    expect(screen.queryByRole('button', {name: /expand/i})).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: /branch/i})).toBeInTheDocument();
  });

  it('renders the edit form when expanded', () => {
    render(
      <TestMapping
        {...{
          editing: true,
          value: {stackRoot: 'src/', sourceRoot: 'app/', branch: 'main'},
        }}
      />
    );

    expect(screen.getByRole('textbox', {name: /branch/i})).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {name: /stack trace prefix/i})
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: /repository prefix/i})).toBeInTheDocument();
  });

  it('shows placeholders on the prefix inputs', () => {
    render(<TestMapping {...{editing: true, isNew: true}} />);

    expect(screen.getByRole('textbox', {name: /stack trace prefix/i})).toHaveAttribute(
      'placeholder',
      'e.g src/'
    );
    expect(screen.getByRole('textbox', {name: /repository prefix/i})).toHaveAttribute(
      'placeholder',
      'e.g src/app/'
    );
  });

  it('renders preview using placeholder example and updates on input', () => {
    render(<TestMapping {...{editing: true, isNew: true}} />);

    expect(screen.getByText('Example preview')).toBeInTheDocument();
    expect(screen.getByText('In your stack trace')).toBeInTheDocument();
    expect(screen.getByText('Sentry opens in your repo')).toBeInTheDocument();
    // No accent highlights — just the bare suffix on each side
    expect(screen.getAllByText('views/index.tsx')).toHaveLength(2);
  });

  it('accents only the filled prefix once a value is typed', async () => {
    render(<TestMapping {...{editing: true, isNew: true}} />);

    await userEvent.type(
      screen.getByRole('textbox', {name: /stack trace prefix/i}),
      'lib/'
    );

    expect(screen.getByText('lib/')).toBeInTheDocument();
  });

  it('explains the disabled delete with a link to Code Owners', async () => {
    render(
      <TestMapping
        {...{
          projectSlug: 'my-project',
          value: {
            stackRoot: 'src/',
            sourceRoot: 'app/',
            branch: 'main',
            hasCodeOwner: true,
          },
        }}
      />
    );

    const deleteButton = screen.getByRole('button', {name: 'Delete path mapping'});
    expect(deleteButton).toHaveAttribute('aria-disabled', 'true');

    await userEvent.hover(deleteButton);

    expect(await screen.findByRole('link', {name: 'Code Owners'})).toHaveAttribute(
      'href',
      expect.stringContaining('/projects/my-project/ownership/')
    );
    expect(
      screen.getByText(/Remove the Code Owners connection before editing these paths/)
    ).toBeInTheDocument();
  });
});
