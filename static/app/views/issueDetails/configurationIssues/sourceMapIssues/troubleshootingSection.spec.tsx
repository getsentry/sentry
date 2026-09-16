import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {SourceMapDiagnosis} from './sourceMapDiagnosis';
import {TroubleshootingSection} from './troubleshootingSection';

describe('TroubleshootingSection', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({slug: 'my-project'});
  const sourcemapsDocsUrl = 'https://docs.sentry.io/platforms/javascript/sourcemaps/';

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {writeText: jest.fn().mockResolvedValue(undefined)},
    });
  });

  it.each<{detail: string; diagnosis: SourceMapDiagnosis; title: string}>([
    {
      diagnosis: {
        type: 'dist-mismatch',
        artifact: 'source-file',
        path: 'app.js',
        dist: 'web-build',
        release: null,
      },
      title: 'Match the Distribution Value',
      detail: 'web-build',
    },
    {
      diagnosis: {type: 'missing-source', path: '/static/app.js', release: null},
      title: 'Upload the Missing Source File',
      detail: '/static/app.js',
    },
    {
      diagnosis: {
        type: 'missing-map',
        path: 'app.js',
        reference: 'app.js.map',
        release: null,
      },
      title: 'Upload the Referenced Source Map',
      detail: 'app.js.map',
    },
    {
      diagnosis: {
        type: 'fetch-failure',
        artifact: 'source-map',
        url: 'https://example.com/app.js.map',
        reason: 'timeout',
      },
      title: 'Check Source File Access',
      detail: 'https://example.com/app.js.map',
    },
  ])(
    'leads with $title for the diagnosed failure',
    async ({diagnosis, title, detail}) => {
      render(
        <TroubleshootingSection
          project={project}
          sourcemapsDocsUrl={sourcemapsDocsUrl}
          diagnosis={diagnosis}
        />,
        {organization}
      );

      expect(screen.getAllByRole('button', {expanded: true})[0]).toHaveTextContent(title);
      expect(screen.getByText(detail)).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Verify Artifacts Are Uploaded'})
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: 'Copy'}));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining(`## ${title}`)
      );
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining(detail)
      );
    }
  );

  it('expands only the recommendation when the diagnosis arrives later', async () => {
    const {rerender} = render(
      <TroubleshootingSection project={project} sourcemapsDocsUrl={sourcemapsDocsUrl} />,
      {organization}
    );
    expect(screen.getByRole('button', {expanded: true})).toHaveTextContent(
      'Verify Artifacts Are Uploaded'
    );

    rerender(
      <TroubleshootingSection
        project={project}
        sourcemapsDocsUrl={sourcemapsDocsUrl}
        diagnosis={{type: 'missing-source', path: 'app.js', release: null}}
      />
    );

    expect(screen.getByRole('button', {expanded: true})).toHaveTextContent(
      'Upload the Missing Source File'
    );
    await userEvent.click(
      screen.getByRole('button', {name: 'Upload the Missing Source File'})
    );
    await userEvent.click(
      screen.getByRole('button', {name: 'Verify Artifacts Are Uploaded'})
    );
    expect(screen.getByRole('button', {expanded: true})).toHaveTextContent(
      'Verify Artifacts Are Uploaded'
    );
  });

  it('preserves a step the user opened while waiting for the diagnosis', async () => {
    const {rerender} = render(
      <TroubleshootingSection project={project} sourcemapsDocsUrl={sourcemapsDocsUrl} />,
      {organization}
    );
    const productionBuild = screen.getByRole('button', {
      name: "Verify That You're Running a Production Build",
    });
    await userEvent.click(productionBuild);

    rerender(
      <TroubleshootingSection
        project={project}
        sourcemapsDocsUrl={sourcemapsDocsUrl}
        diagnosis={{type: 'missing-source', path: 'app.js', release: null}}
      />
    );

    expect(productionBuild).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('button', {name: 'Verify Artifacts Are Uploaded'})
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('copies all selected instructions even when their disclosures are collapsed', async () => {
    render(
      <TroubleshootingSection project={project} sourcemapsDocsUrl={sourcemapsDocsUrl} />,
      {organization}
    );
    await userEvent.click(
      screen.getByRole('button', {name: 'Verify Artifacts Are Uploaded'})
    );
    await userEvent.click(screen.getByRole('button', {name: 'Copy'}));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('both the minified files')
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('production build')
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining(
        `[Settings](/settings/${organization.slug}/projects/${project.slug}/source-maps/)`
      )
    );
  });

  it('updates displayed and copied recommendations when the diagnosis changes', async () => {
    const {rerender} = render(
      <TroubleshootingSection
        project={project}
        sourcemapsDocsUrl={sourcemapsDocsUrl}
        diagnosis={{type: 'missing-source', path: 'old.js', release: null}}
      />,
      {organization}
    );
    rerender(
      <TroubleshootingSection
        project={project}
        sourcemapsDocsUrl={sourcemapsDocsUrl}
        diagnosis={{
          type: 'missing-map',
          path: 'new.js',
          reference: 'new.js.map',
          release: null,
        }}
      />
    );
    expect(
      screen.queryByRole('button', {name: 'Upload the Missing Source File'})
    ).not.toBeInTheDocument();
    expect(screen.getByText('new.js.map')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Copy'}));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('new.js.map')
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.not.stringContaining('old.js')
    );
  });

  it('renders all troubleshooting step titles', () => {
    render(
      <TroubleshootingSection project={project} sourcemapsDocsUrl={sourcemapsDocsUrl} />,
      {organization}
    );

    expect(screen.getByText('Verify Artifacts Are Uploaded')).toBeInTheDocument();
    expect(
      screen.getByText("Verify That You're Building Source Maps")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Verify That You're Running a Production Build")
    ).toBeInTheDocument();
    expect(
      screen.getByText('Verify Your Source Files Contain Debug ID Injection Snippets')
    ).toBeInTheDocument();
  });

  it('settings link points to the correct project source maps URL', () => {
    render(
      <TroubleshootingSection project={project} sourcemapsDocsUrl={sourcemapsDocsUrl} />,
      {organization}
    );

    expect(screen.getByRole('button', {name: /settings/i})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/projects/${project.slug}/source-maps/`
    );
  });

  it('renders the footer docs link', () => {
    render(
      <TroubleshootingSection project={project} sourcemapsDocsUrl={sourcemapsDocsUrl} />,
      {organization}
    );

    expect(screen.getByRole('link', {name: /read all documentation/i})).toHaveAttribute(
      'href',
      `${sourcemapsDocsUrl}troubleshooting_js/`
    );
  });
});
