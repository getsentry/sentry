import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import UpdatedEmptyState from 'sentry/components/updatedEmptyState';
import {useNavigate} from 'sentry/utils/useNavigate';

jest.mock('sentry/utils/useNavigate');

const mockUseNavigate = jest.mocked(useNavigate);
const mockNavigate = jest.fn();
mockUseNavigate.mockReturnValue(mockNavigate);

describe('UpdatedEmptyState', function () {
  const router = RouterFixture();

  it('Renders updated empty state', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/keys/`,
      method: 'GET',
      body: [ProjectKeysFixture()[0]],
    });

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/`,
      method: 'GET',
      body: ProjectFixture({platform: 'python-django', firstEvent: null}),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/sdks/`,
      method: 'GET',
    });

    render(<UpdatedEmptyState project={ProjectFixture({platform: 'python-django'})} />, {
      router,
    });
    expect(await screen.findByText('Get Started with Sentry Issues')).toBeInTheDocument();
    expect(await screen.findByText('Set up the Sentry SDK')).toBeInTheDocument();
    expect(await screen.findByText('Preview a Sentry Issue')).toBeInTheDocument();

    expect(
      await screen.findByText(
        textWithMarkupMatcher('Install sentry-sdk from PyPI with the django extra:')
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
