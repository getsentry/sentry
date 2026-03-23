import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import UpdatedEmptyState from 'sentry/components/updatedEmptyState';

function renderMockRequests({firstIssue}: {firstIssue?: string} = {}) {
  MockApiClient.addMockResponse({
    url: `/projects/org-slug/project-slug/keys/`,
    method: 'GET',
    body: [ProjectKeysFixture()[0]],
  });

  MockApiClient.addMockResponse({
    url: '/projects/org-slug/project-slug/issues/',
    method: 'GET',
    body: firstIssue ? [GroupFixture({id: '1', firstSeen: firstIssue})] : [],
  });

  MockApiClient.addMockResponse({
    url: `/projects/org-slug/project-slug/`,
    method: 'GET',
    body: ProjectFixture({platform: 'python-django', firstEvent: firstIssue ?? null}),
  });

  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/sdks/`,
    method: 'GET',
  });
}

describe('UpdatedEmptyState', () => {
  it('Empty state without first error event', async () => {
    renderMockRequests();

    render(<UpdatedEmptyState project={ProjectFixture({platform: 'python-django'})} />);

    expect(await screen.findByText('Get Started with Sentry Issues')).toBeInTheDocument();
    expect(screen.getByText(/Set up the Sentry SDK/)).toBeInTheDocument();
    expect(screen.getByText('Preview a Sentry Issue')).toBeInTheDocument();

    expect(
      screen.getByText(textWithMarkupMatcher('Install sentry-sdk from PyPI:'))
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(
      await screen.findByText(
        textWithMarkupMatcher('Initialize the Sentry SDK in your Django settings.py file')
      )
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(
      await screen.findByText(
        'You can easily verify your Sentry installation by creating a route that triggers an error:'
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText("Waiting for this project's first error")
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Back'})).toBeEnabled();

    expect(
      screen.queryByRole('button', {name: 'Take me to my error'})
    ).not.toBeInTheDocument();
  });

  it('Empty state with first error event', async () => {
    const firstIssue = new Date().toISOString();

    renderMockRequests({firstIssue});
    render(<UpdatedEmptyState project={ProjectFixture({platform: 'python-django'})} />);

    expect(await screen.findByText('Get Started with Sentry Issues')).toBeInTheDocument();
    expect(screen.getByText(/Set up the Sentry SDK/)).toBeInTheDocument();
    expect(screen.getByText('Preview a Sentry Issue')).toBeInTheDocument();

    expect(
      screen.getByText(textWithMarkupMatcher('Install sentry-sdk from PyPI:'))
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(
      await screen.findByText(
        textWithMarkupMatcher('Initialize the Sentry SDK in your Django settings.py file')
      )
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(
      await screen.findByText(
        'You can easily verify your Sentry installation by creating a route that triggers an error:'
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Take me to my error'})).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/1/?referrer=onboarding-first-event-indicator`
    );

    expect(screen.getByRole('button', {name: 'Back'})).toBeEnabled();

    expect(
      screen.queryByText("Waiting for this project's first error")
    ).not.toBeInTheDocument();
  });
});
