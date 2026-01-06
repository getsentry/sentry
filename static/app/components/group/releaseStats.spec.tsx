import {EnvironmentsFixture} from 'sentry-fixture/environments';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import GroupReleaseStats from 'sentry/components/group/releaseStats';

describe('GroupReleaseStats', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const group = GroupFixture();

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

  it('renders all environments', () => {
    createWrapper({});
    expect(screen.getByText('Last 24 Hours')).toBeInTheDocument();
    expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
    expect(screen.getByText('Last Seen')).toBeInTheDocument();
    expect(screen.getByText('First Seen')).toBeInTheDocument();
    // Displays counts
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
  });

  it('renders specific environments', () => {
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
