import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import Onboarding from 'sentry/views/performance/onboarding';

describe('Performance Onboarding View > Unsupported Banner', function () {
  const organization = OrganizationFixture();

  it('Displays unsupported banner for unsupported projects', function () {
    const project = ProjectFixture({
      platform: 'nintendo-switch',
    });
    render(<Onboarding organization={organization} project={project} />);

    expect(screen.getByTestId('unsupported-alert')).toBeInTheDocument();
  });

  it('Does not display unsupported banner for supported projects', function () {
    const project = ProjectFixture({
      platform: 'java',
    });
    render(<Onboarding organization={organization} project={project} />);

    expect(screen.queryByTestId('unsupported-alert')).not.toBeInTheDocument();
  });
});

describe('Testing new onboarding ui', function () {
  const organization = OrganizationFixture({
    features: ['tracing-onboarding-new-ui'],
  });

  it('Renders updated ui', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/keys/`,
      method: 'GET',
      body: [ProjectKeysFixture()[0]],
    });

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/`,
      method: 'GET',
      body: ProjectFixture({platform: 'javascript-react', firstEvent: null}),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/sdks/`,
      method: 'GET',
    });

    render(
      <Onboarding
        organization={organization}
        project={ProjectFixture({platform: 'javascript-react'})}
      />
    );
    expect(await screen.findByText('Query for Traces, Get Answers')).toBeInTheDocument();
    expect(await screen.findByText('Preview a Sentry Trace')).toBeInTheDocument();

    expect(
      await screen.findByText(
        textWithMarkupMatcher('Add the Sentry SDK as a dependency using npm or yarn')
      )
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Configuration should happen as early as possible in your application's lifecycle."
        )
      )
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(await screen.findByText(/Add Distributed Tracing/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(
      await screen.findByText(/Verify that performance monitoring is working correctly/)
    ).toBeInTheDocument();

    expect(
      await screen.findByText("Waiting for this project's first trace")
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {name: 'Take me to an example'})
    ).toBeInTheDocument();
  });
});
