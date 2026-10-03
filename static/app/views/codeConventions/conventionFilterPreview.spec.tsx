import fetchMock from 'jest-fetch-mock';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  ConventionFilterPreview,
  FiltersYamlPreview,
} from 'sentry/views/codeConventions/conventionFilterPreview';

const FILES: Record<string, string> = {
  'static/app/profile.tsx': 'class Profile extends Component {}',
  'static/app/avatar.tsx': 'function Avatar() { return null; }',
  'static/app/profile.spec.tsx': 'class Fake extends Component {}',
  'src/sentry/models.py': 'class Model: pass',
};

function mockGitHub() {
  fetchMock.mockResponse(request => {
    if (request.url.includes('/git/trees/')) {
      return JSON.stringify({
        tree: [
          ...Object.keys(FILES).map(path => ({path, mode: '100644', type: 'blob'})),
          {path: 'static/app', mode: '040000', type: 'tree'},
        ],
      });
    }
    const path = Object.keys(FILES).find(file => request.url.endsWith(`/master/${file}`));
    return path ? FILES[path]! : {status: 404, body: ''};
  });
}

describe('ConventionFilterPreview', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    mockGitHub();
  });

  it('lists files matching the include and exclude globs', async () => {
    render(
      <ConventionFilterPreview
        filters={{include: ['static/**/*.tsx'], exclude: ['**/*.spec.*']}}
      />
    );

    expect(
      await screen.findByText('2 files match the include and exclude globs. A sample:')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: 'static/app/profile.tsx'})
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'static/app/avatar.tsx'})).toBeInTheDocument();
  });

  it('reads candidate files to find prefilter matches', async () => {
    render(
      <ConventionFilterPreview
        filters={{
          exclude: ['**/*.spec.*'],
          prefilter:
            "grep -rlE --include='*.tsx' 'extends Component' {repo_path}/static/",
        }}
      />
    );

    expect(
      await screen.findByText(/Of 2 read so far, 1 match the prefilter pattern/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: 'static/app/profile.tsx'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {name: 'static/app/avatar.tsx'})
    ).not.toBeInTheDocument();
  });

  it('explains when filters cannot be previewed', async () => {
    render(<ConventionFilterPreview filters={{detect_command: 'bash detect.sh'}} />);

    expect(
      await screen.findByText(
        'Files chosen by a detect_command script cannot be previewed.'
      )
    ).toBeInTheDocument();
  });
});

describe('FiltersYamlPreview', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    mockGitHub();
  });

  it('updates the preview from edited YAML', async () => {
    render(<FiltersYamlPreview yaml={'include:\n  - "static/**/*.tsx"\n'} />);

    expect(
      await screen.findByText('3 files match the include and exclude globs. A sample:')
    ).toBeInTheDocument();
  });

  it('shows YAML errors', async () => {
    render(<FiltersYamlPreview yaml="include: [unclosed" />);

    expect(
      await screen.findByText(/Flow sequence|unclosed|Missing/i)
    ).toBeInTheDocument();
  });
});
