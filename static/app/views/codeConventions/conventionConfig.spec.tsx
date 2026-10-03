import {parse} from 'yaml';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConventionConfig} from 'sentry/views/codeConventions/conventionConfig';

const YAML = `
name: no-class-components
severity: warning
tags: [react, migration]

why: |
  Class components are the **legacy** style.

detect: |
  Look for classes that extend \`Component\`.

fix: |
  Convert to a function component.

examples:
  bad:
    - 'class Profile extends Component {}'
  good:
    - 'function Profile() { return null; }'

include:
  - "static/**/*.tsx"
exclude:
  - "**/*.spec.*"
prefilter: "grep -rl 'extends Component' {repo_path}/static/"
`;

describe('ConventionConfig', () => {
  it('renders severity, tags, and a section per field', () => {
    render(
      <ConventionConfig filename="no-class-components.yaml" convention={parse(YAML)} />
    );

    expect(screen.getByText('Severity')).toBeInTheDocument();
    expect(screen.getByText('warning')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('migration')).toBeInTheDocument();

    for (const title of ['Why', 'Detect', 'Fix', 'Examples', 'Filters']) {
      expect(screen.getByRole('button', {name: title})).toHaveAttribute(
        'aria-expanded',
        'true'
      );
    }

    expect(screen.getByText('legacy')).toBeInTheDocument();
    expect(screen.getByText('class Profile extends Component {}')).toBeInTheDocument();
    expect(screen.getByText('function Profile() { return null; }')).toBeInTheDocument();

    expect(screen.queryByText('static/**/*.tsx')).not.toBeInTheDocument();
    expect(screen.queryByText('**/*.spec.*')).not.toBeInTheDocument();
    expect(screen.getByText('Prefilter')).toBeInTheDocument();
    expect(
      screen.getByText("grep -rl 'extends Component' {repo_path}/static/")
    ).toBeInTheDocument();
  });

  it('collapses a section', async () => {
    render(
      <ConventionConfig filename="no-class-components.yaml" convention={parse(YAML)} />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Why'}));

    expect(screen.getByRole('button', {name: 'Why'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.getByText('legacy')).not.toBeVisible();
  });

  it('shows a detect command under filters', () => {
    render(
      <ConventionConfig
        filename="no-class-components.yaml"
        convention={{
          name: 'no-deprecated-callsite',
          detect_command: 'bash {convention_dir}/detect.sh {repo_path}',
        }}
      />
    );

    expect(screen.getByRole('button', {name: 'Filters'})).toBeInTheDocument();
    expect(screen.getByText('Detect Command')).toBeInTheDocument();
    expect(
      screen.getByText('bash {convention_dir}/detect.sh {repo_path}')
    ).toBeInTheDocument();
  });

  it('toggles an edit mode with editable text areas that cannot be saved', async () => {
    render(
      <ConventionConfig filename="no-class-components.yaml" convention={parse(YAML)} />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Edit'}));

    expect(screen.queryByRole('button', {name: 'Why'})).not.toBeInTheDocument();

    expect(
      screen.getByText(/Saving changes is not supported. Create a PR at/)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'no-class-components.yaml'})).toHaveAttribute(
      'href',
      'https://github.com/getsentry/sentry/blob/master/.sentry-refactor-tasks/conventions/no-class-components.yaml'
    );

    const why = screen.getByRole('textbox', {name: 'Why'});
    expect(why).toHaveValue('Class components are the **legacy** style.\n');
    await userEvent.clear(why);
    await userEvent.type(why, 'Edited');
    expect(why).toHaveValue('Edited');

    expect(screen.getByRole('textbox', {name: 'Examples'})).toHaveDisplayValue(
      /bad:\n {2}- class Profile extends Component \{\}/
    );
    expect(screen.getByRole('textbox', {name: 'Prefilter'})).toHaveValue(
      "grep -rl 'extends Component' {repo_path}/static/"
    );
    expect(screen.getByRole('button', {name: 'Save'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(screen.queryByRole('textbox', {name: 'Why'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Why'})).toBeInTheDocument();
  });

  it('skips sections that are missing', () => {
    render(
      <ConventionConfig
        filename="no-class-components.yaml"
        convention={{name: 'only-why', why: 'Because.'}}
      />
    );

    expect(screen.getByRole('button', {name: 'Why'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Fix'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Filters'})).not.toBeInTheDocument();
    expect(screen.queryByText('Severity')).not.toBeInTheDocument();
    expect(screen.queryByText('Tags')).not.toBeInTheDocument();
  });
});
