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
`;

describe('ConventionConfig', () => {
  it('renders severity, tags, and a section per field', () => {
    render(<ConventionConfig convention={parse(YAML)} />);

    expect(screen.getByText('warning')).toBeInTheDocument();
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('migration')).toBeInTheDocument();

    for (const title of ['Why', 'Detect', 'Fix', 'Examples']) {
      expect(screen.getByRole('button', {name: title})).toHaveAttribute(
        'aria-expanded',
        'true'
      );
    }

    expect(screen.getByText('legacy')).toBeInTheDocument();
    expect(screen.getByText('class Profile extends Component {}')).toBeInTheDocument();
    expect(screen.getByText('function Profile() { return null; }')).toBeInTheDocument();
  });

  it('collapses a section', async () => {
    render(<ConventionConfig convention={parse(YAML)} />);

    await userEvent.click(screen.getByRole('button', {name: 'Why'}));

    expect(screen.getByRole('button', {name: 'Why'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.getByText('legacy')).not.toBeVisible();
  });

  it('skips sections that are missing', () => {
    render(<ConventionConfig convention={{name: 'only-why', why: 'Because.'}} />);

    expect(screen.getByRole('button', {name: 'Why'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Fix'})).not.toBeInTheDocument();
  });
});
