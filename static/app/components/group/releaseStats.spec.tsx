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

  const defaultProps = {
    group,
    project,
    organization,
    allEnvironments: GroupFixture(),
    environments: [],
    currentRelease: undefined,
  } satisfies React.ComponentProps<typeof GroupReleaseStats>;

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/first-last-release/`,
      body: {id: group.id, firstRelease: undefined, lastRelease: undefined},
    });
  });

  it('renders all environments', () => {
    render(<GroupReleaseStats {...defaultProps} />);
    expect(screen.getByText('Last 24 Hours')).toBeInTheDocument();
    expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
    expect(screen.getByText('Last Seen')).toBeInTheDocument();
    expect(screen.getByText('First Seen')).toBeInTheDocument();
    // Displays counts
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
  });

  it('renders specific environments', () => {
    render(
      <GroupReleaseStats
        {...defaultProps}
        environments={EnvironmentsFixture().map(environment => environment.displayName)}
      />
    );
    expect(screen.getByText('Last 24 Hours')).toBeInTheDocument();
    expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
    expect(screen.getByText('Last Seen')).toBeInTheDocument();
    expect(screen.getByText('First Seen')).toBeInTheDocument();
    // Displays counts
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
  });
});
