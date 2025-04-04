import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {useNavigate} from 'sentry/utils/useNavigate';

import {LegacyOnboarding, Onboarding} from './onboarding';

jest.mock('sentry/utils/useNavigate');

const mockUseNavigate = jest.mocked(useNavigate);
const mockNavigate = jest.fn();
mockUseNavigate.mockReturnValue(mockNavigate);

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

  const router = RouterFixture();

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
        textWithMarkupMatcher(
          'Add the Sentry SDK as a dependency using npm, yarn, or pnpm'
        )
      )
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        ...router.location,
        query: {guidedStep: 2},
      })
    );
  });
});
