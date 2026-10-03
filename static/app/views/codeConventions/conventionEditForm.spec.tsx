import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ConventionEditForm} from 'sentry/views/codeConventions/conventionEditForm';

describe('ConventionEditForm', () => {
  it('shows every field, empty, for a new convention', () => {
    render(<ConventionEditForm convention={{name: ''}} />);

    for (const name of ['Why', 'Detect', 'Fix', 'Examples', 'Prefilter']) {
      expect(screen.getByRole('textbox', {name})).toHaveValue('');
    }
    expect(
      screen.getByRole('link', {name: 'Create a PR adding a convention file'})
    ).toHaveAttribute(
      'href',
      'https://github.com/getsentry/sentry/new/master/.sentry-refactor-tasks/conventions'
    );
    expect(screen.getByRole('button', {name: 'Save'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('only shows fields an existing convention has', () => {
    render(
      <ConventionEditForm
        convention={{name: 'only-why', why: 'Because.'}}
        filename="only-why.yaml"
      />
    );

    expect(screen.getByRole('textbox', {name: 'Why'})).toHaveValue('Because.');
    expect(screen.queryByRole('textbox', {name: 'Fix'})).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'only-why.yaml'})).toBeInTheDocument();
  });
});
