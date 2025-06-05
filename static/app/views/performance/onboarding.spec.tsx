import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {Tab} from 'sentry/views/explore/hooks/useTab';

import {LegacyOnboarding, Onboarding} from './onboarding';

describe('Performance Onboarding View > Unsupported Banner', function () {
  const organization = OrganizationFixture();

  it('Displays unsupported banner for unsupported projects', function () {
    const project = ProjectFixture({
      platform: 'nintendo-switch',
    });
    render(<LegacyOnboarding organization={organization} project={project} />);

    expect(screen.getByTestId('unsupported-alert')).toBeInTheDocument();
  });

  it('Does not display unsupported banner for supported projects', function () {
    const project = ProjectFixture({
      platform: 'java',
    });
    render(<LegacyOnboarding organization={organization} project={project} />);

    expect(screen.queryByTestId('unsupported-alert')).not.toBeInTheDocument();
  });
});

describe('Testing new onboarding ui', function () {
  const organization = OrganizationFixture({
    features: ['tracing-onboarding-new-ui'],
  });

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/keys/`,
      method: 'GET',
      body: [ProjectKeysFixture()[0]],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/sdks/`,
      method: 'GET',
    });
  });

  it('Renders updated ui', async function () {
    const projectMock = ProjectFixture({
      platform: 'javascript-react',
    });

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/`,
      method: 'GET',
      body: projectMock,
    });

    render(<Onboarding organization={organization} project={projectMock} />);
    expect(await screen.findByText('Query for Traces, Get Answers')).toBeInTheDocument();
    expect(await screen.findByText('Preview a Sentry Trace')).toBeInTheDocument();

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'Add the Sentry SDK as a dependency using npm, yarn, or pnpm'
        )
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

  it('when the first trace is received, display the button "Take me to traces"', async function () {
    const projectMock = ProjectFixture({
      platform: 'javascript-react',
      firstTransactionEvent: true,
    });

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/`,
      method: 'GET',
      body: projectMock,
    });

    const {router} = render(
      <Onboarding organization={organization} project={projectMock} />,
      {
        initialRouterConfig: {
          location: {
            pathname: RouterFixture().location.pathname,
            query: {
              guidedStep: '4',
            },
          },
        },
      }
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Take me to traces'}));
    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          query: {
            guidedStep: undefined,
            table: Tab.TRACE,
          },
        })
      );
    });
    expect(window.location.reload).toHaveBeenCalled();
  });
});
