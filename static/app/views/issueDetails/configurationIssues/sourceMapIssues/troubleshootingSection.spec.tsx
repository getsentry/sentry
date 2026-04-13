import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TroubleshootingSection} from './troubleshootingSection';

describe('TroubleshootingSection', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({slug: 'my-project'});

  it('renders all troubleshooting step titles', () => {
    render(<TroubleshootingSection project={project} />, {organization});

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
    render(<TroubleshootingSection project={project} />, {organization});

    expect(screen.getByRole('button', {name: /settings/i})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/projects/${project.slug}/source-maps/`
    );
  });

  it('renders the footer docs link', () => {
    render(<TroubleshootingSection project={project} />, {organization});

    expect(screen.getByRole('link', {name: /read all documentation/i})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/'
    );
  });
});
