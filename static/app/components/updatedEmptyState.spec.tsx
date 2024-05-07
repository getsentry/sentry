import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import UpdatedEmptyState from 'sentry/components/updatedEmptyState';

describe('UpdatedEmptyState', function () {
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

    render(<UpdatedEmptyState project={ProjectFixture({platform: 'python-django'})} />);
    expect(await screen.findByText('Get Started with Sentry Issues')).toBeInTheDocument();
    expect(await screen.findByText('Set up the Sentry SDK')).toBeInTheDocument();
    expect(await screen.findByText('Preview a Sentry Issue')).toBeInTheDocument();

    expect(
      await screen.findByText(
        'Use the following command to install our Python Django SDK'
      )
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(
      await screen.findByText(
        'If you have the Django package in your dependencies, the Django integration will be enabled automatically when you initialize the Sentry SDK. Initialize the Sentry SDK in your Django settings.py file'
      )
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(
      await screen.findByText(
        'Add this intentional error to your application to test that everything is working right away.'
      )
    ).toBeInTheDocument();

    expect(
      await screen.findByText('Waiting to receive first event to continue')
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Take me to my error'})).toBeDisabled();
  });
});
