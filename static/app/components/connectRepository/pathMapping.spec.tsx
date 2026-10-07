import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';

import {PathMapping} from 'sentry/components/connectRepository/pathMapping';
import type {PathMappingValue} from 'sentry/components/connectRepository/type';

function renderMapping({
  value = {stackRoot: '', sourceRoot: '', branch: ''},
  editing = false,
  isNew = false,
}: {
  editing?: boolean;
  isNew?: boolean;
  value?: PathMappingValue;
} = {}) {
  function Wrapper() {
    const form = useScrapsForm({
      ...defaultFormOptions,
      defaultValues: {repository: null as string | null, pathMappings: [value]},
      onSubmit: () => {},
    });
    return (
      <form.AppForm form={form}>
        <PathMapping
          editing={editing}
          fields="pathMappings[0]"
          form={form}
          isNew={isNew}
          value={value}
          onDelete={jest.fn()}
          onExpandToggle={jest.fn()}
        />
      </form.AppForm>
    );
  }
  return render(<Wrapper />);
}

describe('PathMapping', () => {
  it('renders collapsed summary with paths and branch', () => {
    renderMapping({value: {stackRoot: 'src/', sourceRoot: 'app/', branch: 'main'}});

    expect(screen.getByText('src/')).toBeInTheDocument();
    expect(screen.getByText('app/')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', {name: /stack trace prefix/i})
    ).not.toBeInTheDocument();
  });

  it('shows empty placeholder when paths are blank', () => {
    renderMapping({value: {stackRoot: '', sourceRoot: '', branch: 'main'}});

    expect(screen.getAllByText('empty')).toHaveLength(2);
  });

  it('hides the summary row for a new (never-saved) mapping', () => {
    renderMapping({
      editing: true,
      isNew: true,
      value: {stackRoot: 'src/', sourceRoot: 'app/', branch: 'main'},
    });

    expect(screen.queryByRole('button', {name: /expand/i})).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: /branch/i})).toBeInTheDocument();
  });

  it('renders the edit form when expanded', () => {
    renderMapping({
      editing: true,
      value: {stackRoot: 'src/', sourceRoot: 'app/', branch: 'main'},
    });

    expect(screen.getByRole('textbox', {name: /branch/i})).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {name: /stack trace prefix/i})
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: /repository prefix/i})).toBeInTheDocument();
  });

  it('shows placeholders on the prefix inputs', () => {
    renderMapping({editing: true, isNew: true});

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
    renderMapping({editing: true, isNew: true});

    expect(screen.getByText('Example preview')).toBeInTheDocument();
    expect(screen.getByText('In your stack trace')).toBeInTheDocument();
    expect(screen.getByText('Sentry opens in your repo')).toBeInTheDocument();
    // No accent highlights — just the bare suffix on each side
    expect(screen.getAllByText('views/index.tsx')).toHaveLength(2);
  });

  it('accents only the filled prefix once a value is typed', async () => {
    renderMapping({editing: true, isNew: true});

    await userEvent.type(
      screen.getByRole('textbox', {name: /stack trace prefix/i}),
      'lib/'
    );

    expect(screen.getByText('lib/')).toBeInTheDocument();
  });
});
