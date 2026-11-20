import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {FirstEventFooter} from './firstEventFooter';

describe('FirstEventFooter', () => {
  const organization = OrganizationFixture();

  function renderFooter(project = ProjectFixture()) {
    return render(
      <FirstEventFooter
        organization={organization}
        project={project}
        isLast
        onClickSetupLater={jest.fn()}
      />,
      {organization}
    );
  }

  it('links to the issue whose firstSeen is nearest to the first event', async () => {
    const project = ProjectFixture({firstEvent: '2026-04-21T00:00:00.123456Z'});
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/issues/`,
      body: [
        GroupFixture({id: '10', firstSeen: '2026-04-21T00:05:00Z'}),
        GroupFixture({id: '20', firstSeen: '2026-04-21T00:00:00Z'}),
      ],
    });

    renderFooter(project);

    const button = await screen.findByRole('button', {name: 'Take me to my error'});
    await waitFor(() =>
      expect(button).toHaveAttribute(
        'href',
        `/organizations/${organization.slug}/issues/20/?referrer=onboarding-first-event-footer`
      )
    );
  });

  it('falls back to the project issue list when the project has no issues', async () => {
    const project = ProjectFixture({firstEvent: '2026-04-21T00:00:00Z'});
    const issuesRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/issues/`,
      body: [],
    });

    renderFooter(project);

    const button = await screen.findByRole('button', {name: 'Take me to my error'});
    await waitFor(() => expect(issuesRequest).toHaveBeenCalled());
    expect(button).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/?project=${project.id}&referrer=onboarding-first-event-footer`
    );
  });
});
