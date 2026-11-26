import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';

import {FirstEventFooter} from './firstEventFooter';

describe('FirstEventFooter', () => {
  const organization = OrganizationFixture();

  it('links to the issue whose firstSeen is nearest to the first event', async () => {
    const project = ProjectFixture({firstEvent: '2026-04-21T00:00:00.123456Z'});
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/issues/`,
      body: [
        GroupFixture({id: '10', firstSeen: '2026-04-21T00:05:00Z'}),
        GroupFixture({id: '20', firstSeen: '2026-04-21T00:00:00Z'}),
      ],
    });

    render(
      <FirstEventFooter
        organization={organization}
        project={project}
        onClickSetupLater={jest.fn()}
      />,
      {organization}
    );

    const button = await screen.findByRole('button', {name: 'Take me to my error'});
    await waitFor(() =>
      expect(button).toHaveAttribute(
        'href',
        `/organizations/${organization.slug}/issues/20/?referrer=onboarding-first-event-footer`
      )
    );
    expect(screen.queryByRole('button', {name: 'Set up later'})).not.toBeInTheDocument();
  });

  it('falls back to the project issue list when the project has no issues', async () => {
    const project = ProjectFixture({firstEvent: '2026-04-21T00:00:00Z'});
    const issuesRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/issues/`,
      body: [],
    });

    render(
      <FirstEventFooter
        organization={organization}
        project={project}
        onClickSetupLater={jest.fn()}
      />,
      {organization}
    );

    const button = await screen.findByRole('button', {name: 'Take me to my error'});
    await waitFor(() => expect(issuesRequest).toHaveBeenCalled());
    expect(button).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/?project=${project.id}&referrer=onboarding-first-event-footer`
    );
  });

  describe('onboarding session', () => {
    function setUpOnboardingSession() {
      const project = ProjectFixture({firstEvent: '2026-04-21T00:00:00Z'});
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/issues/`,
        body: [GroupFixture({id: '20', firstSeen: '2026-04-21T00:00:00Z'})],
      });
      sessionStorageWrapper.setItem(
        'onboarding',
        JSON.stringify({selectedPlatform: {key: project.platform}})
      );
      return project;
    }

    it('clears the session when the user goes to their error', async () => {
      const project = setUpOnboardingSession();

      render(
        <OnboardingContextProvider>
          <FirstEventFooter
            organization={organization}
            project={project}
            onClickSetupLater={jest.fn()}
          />
        </OnboardingContextProvider>,
        {organization}
      );

      await userEvent.click(
        await screen.findByRole('button', {name: 'Take me to my error'})
      );

      expect(sessionStorageWrapper.getItem('onboarding')).toBeNull();
    });

    it('keeps the session when the error opens in a new tab', async () => {
      const project = setUpOnboardingSession();

      render(
        <OnboardingContextProvider>
          <FirstEventFooter
            organization={organization}
            project={project}
            onClickSetupLater={jest.fn()}
          />
        </OnboardingContextProvider>,
        {organization}
      );

      fireEvent.click(await screen.findByRole('button', {name: 'Take me to my error'}), {
        metaKey: true,
      });

      expect(sessionStorageWrapper.getItem('onboarding')).not.toBeNull();
    });
  });
});
