import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SupergroupSection} from 'sentry/views/issueDetails/streamline/sidebar/supergroupSection';

describe('SupergroupSection', () => {
  it('renders supergroup info when issue belongs to one', async () => {
    const organization = OrganizationFixture({features: ['top-issues-ui']});
    const group = GroupFixture({id: '1'});
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/supergroups/by-group/`,
      body: {
        data: [
          {
            id: 10,
            title: 'Null pointer in auth flow',
            error_type: 'TypeError',
            code_area: 'auth/login',
            summary: '',
            group_ids: [1, 2, 3],
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
      },
    });

    render(<SupergroupSection group={group} />, {organization});

    expect(await screen.findByText('TypeError')).toBeInTheDocument();
    expect(screen.getByText('Null pointer in auth flow')).toBeInTheDocument();
    expect(screen.getByText('3 issues')).toBeInTheDocument();
  });
});
