import {Environments as EnvironmentsFixture} from 'sentry-fixture/environments';
import {Group as GroupFixture} from 'sentry-fixture/group';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import GroupReleaseStats from 'sentry/components/group/releaseStats';

describe('GroupReleaseStats', function () {
  const organization = Organization();
  const project = ProjectFixture();
  const group = GroupFixture();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
      body: {id: group.id, firstRelease: undefined, lastRelease: undefined},
    });
  });

  const createWrapper = (
    props: Partial<React.ComponentProps<typeof GroupReleaseStats>>
  ) =>
    render(
      <GroupReleaseStats
        group={group}
        project={project}
        organization={organization}
        allEnvironments={GroupFixture()}
        environments={[]}
        {...props}
      />
    );

  it('renders all environments', function () {
    createWrapper({});
    expect(screen.getByText('Last 24 Hours')).toBeInTheDocument();
    expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
    expect(screen.getByText('Last Seen')).toBeInTheDocument();
    expect(screen.getByText('First Seen')).toBeInTheDocument();
    // Displays counts
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
  });

  it('renders specific environments', function () {
    createWrapper({
      environments: EnvironmentsFixture().map(environment => environment.displayName),
    });
    expect(screen.getByText('Last 24 Hours')).toBeInTheDocument();
    expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
    expect(screen.getByText('Last Seen')).toBeInTheDocument();
    expect(screen.getByText('First Seen')).toBeInTheDocument();
    // Displays counts
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
  });
});
